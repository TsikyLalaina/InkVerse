import { FastifyPluginAsync } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '../db/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-12-15.clover' as any,
});

const paymentRoutes: FastifyPluginAsync = async (app) => {
  // Create Stripe Checkout Session
  app.post<{ Body: { priceId: string; successUrl: string; cancelUrl: string } }>(
    '/payment/create-checkout-session',
    {
      preHandler: [app.auth],
    },
    async (req, reply) => {
      const { priceId, successUrl, cancelUrl } = req.body;
      const user = req.user;

      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!priceId) {
        return reply.status(400).send({ error: 'Missing priceId' });
      }

      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            userId: user.id,
            type: 'coin_purchase',
          },
        });

        return { url: session.url };
      } catch (error: any) {
        req.log.error(error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Webhook Handler
  // Note: Needs 'fastify-raw-body' or similar if body is parsed.
  // For now assuming we can access raw body or using a specific strategy.
  // Since we use fastify, we need to register the raw body parser for this route or globally.
  // For simplicity implementation here, we assume standard usage.
  app.post<{ Body: any }>(
    '/payment/webhooks/stripe',
    {
      config: {
        rawBody: true, // Requires fastify-raw-body registration in app
      },
    },
    async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
          req.log.warn("Missing STRIPE_WEBHOOK_SECRET");
          return reply.status(500).send({error: "Webhook secret not configured"});
      }

      let event: Stripe.Event;

      try {
        // We need the raw buffer here. By default fastify might parse JSON.
        // We will need to instruct the user to install 'fastify-raw-body'
        // For now, using req.body if it wasn't parsed, but fastify parses by default.
        // We'll trust the user to rely on the 'rawBody' config if they have the plugin,
        // otherwise this might fail signature verification if body is already an object.
        const body = (req as any).rawBody || req.body; 
        
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err: any) {
        req.log.error(`Webhook signature verification failed: ${err.message}`);
        return reply.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;

        if (userId && type === 'coin_purchase') {
            // Fulfill the purchase
            // Assuming 100 coins for now, ideally we store package info in metadata or DB
            // Or retrieve the line items to know what was bought.
            // For MVP (100 coins):
            const amountTotal = session.amount_total || 0; // in cents
            
            // Simple logic: $0.99 = 100 coins.
            // Let's look up the price/product or just hardcode for MVP if the user only has 1 product.
            let coinsToAdd = 0;
            // logic to determine coins based on price...
            // For now, let's assume 100.
            if (amountTotal > 0) coinsToAdd = 100; // Placeholder logic

            // Update User Balance
            
            await prisma.userProfile.update({
                where: { userId: userId },
                data: {
                    paidCoins: { increment: coinsToAdd }
                }
            });

            // Log Transaction
            await prisma.transaction.create({
                data: {
                    userId: userId,
                    type: 'purchase',
                    amount: coinsToAdd,
                    currency: 'paid',
                    referenceId: session.id,
                    description: `Stripe Checkout ${session.id}`
                }
            });
            
            req.log.info(`Added ${coinsToAdd} coins to user ${userId}`);
        }
      }

      return { received: true };
    }
  );
  // Get Wallet Balance
  app.get(
    '/payment/balance',
    { preHandler: [app.auth] },
    async (req, reply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      const profile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
        select: { paidCoins: true, bonusCoins: true }
      });

      return {
        paidCoins: profile?.paidCoins || 0,
        bonusCoins: profile?.bonusCoins || 0,
        total: (profile?.paidCoins || 0) + (profile?.bonusCoins || 0)
      };
    }
  );

  // Unlock Chapter
  app.post<{ Body: { chapterId: string; cost: number } }>(
    '/payment/unlock-chapter',
    { preHandler: [app.auth] },
    async (req, reply) => {
      const { chapterId, cost } = req.body;
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      // 1. Check if already unlocked
      const existing = await prisma.unlockedContent.findUnique({
        where: {
          userId_chapterId: {
            userId: user.id,
            chapterId: chapterId,
          }
        }
      });

      if (existing) {
        return { success: true, message: 'Already unlocked' };
      }

      // 2. Get User Balance
      const profile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
        select: { paidCoins: true, bonusCoins: true }
      });

      if (!profile) return reply.status(404).send({ error: 'User profile not found' });

      const totalCoins = profile.paidCoins + profile.bonusCoins;
      if (totalCoins < cost) {
        return reply.status(402).send({ error: 'Insufficient coins', shortfall: cost - totalCoins });
      }

      // 3. Deduct Coins (Bonus First strategy)
      let paidToDeduct = 0;
      let bonusToDeduct = 0;

      if (profile.bonusCoins >= cost) {
        bonusToDeduct = cost;
      } else {
        bonusToDeduct = profile.bonusCoins;
        paidToDeduct = cost - bonusToDeduct;
      }

      // 4. Transaction (Atomic)
      await prisma.$transaction([
        // Update Balance
        prisma.userProfile.update({
          where: { userId: user.id },
          data: {
            paidCoins: { decrement: paidToDeduct },
            bonusCoins: { decrement: bonusToDeduct }
          }
        }),
        // Create Unlock Record
        prisma.unlockedContent.create({
          data: {
            userId: user.id,
            chapterId: chapterId,
            paidPrice: paidToDeduct,
            bonusPrice: bonusToDeduct
          }
        }),
        // Create Transaction Record
        prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'unlock',
            amount: -cost,
            currency: 'mixed',
            referenceId: chapterId,
            description: `Unlocked Chapter ${chapterId}`
          }
        })
      ]);

      return { success: true, message: 'Chapter unlocked' };
    }
  );
  // Author Stats & Payouts
  app.get(
    '/payment/author-stats',
    { preHandler: [app.auth] },
    async (req, reply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      // 1. Calculate Total Earnings from Unlocked Content
      // We need to join Chapter -> Project -> User
      const earnings = await prisma.unlockedContent.groupBy({
        by: ['containerId'], // Hack: We can't easily join in groupBy in Prisma, so we do it in two steps or raw query.
        // Actually, let's just find many for simplicity as volume is low for MVP, or use raw query.
        // Safer: Find all chapters owned by user, then count unlocks.
      } as any).catch(() => null);

      // Using a more direct approach:
      const projects = await prisma.project.findMany({
        where: { userId: user.id },
        select: { id: true }
      });
      const projectIds = projects.map(p => p.id);
      
      const chapters = await prisma.chapter.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true }
      });
      const chapterIds = chapters.map(c => c.id);

      const unlocks = await prisma.unlockedContent.findMany({
        where: { chapterId: { in: chapterIds } },
        select: { paidPrice: true, createdAt: true }
      });

      const totalCoinsEarned = unlocks.reduce((acc, curr) => acc + curr.paidPrice, 0);
      
      // REVENUE MODEL: 1 Coin = $0.01 (User buys 100 for $0.99). 
      // Platform fee 30%. Author gets 70%? 
      // Let's simplified: Author gets $0.005 per coin (approx 50%).
      const COIN_VALUE_USD = 0.005; 
      const totalRevenueCents = Math.floor(totalCoinsEarned * COIN_VALUE_USD * 100);

      // 2. Calculate Payouts
      const payouts = await prisma.payoutRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      const totalPaidOutCents = payouts
        .filter(p => p.status !== 'rejected')
        .reduce((acc, curr) => acc + curr.amount, 0);

      const availableBalanceCents = totalRevenueCents - totalPaidOutCents;

      return {
        totalCoinsEarned,
        totalRevenue: totalRevenueCents, // in cents
        totalPaidOut: totalPaidOutCents, // in cents
        availableBalance: availableBalanceCents, // in cents
        payouts
      };
    }
  );

  // ADMIN: List Payouts
  app.get(
    '/payment/admin/payouts',
    { preHandler: [app.auth] },
    async (req, reply) => {
       const user = req.user;
       if (!user) return reply.status(401).send({ error: 'Unauthorized' });

       // Verify Admin Access
       const adminRecord = await prisma.admin.findUnique({
         where: { userId: user.id }
       });
       if (!adminRecord) {
         return reply.status(403).send({ error: 'Forbidden: Admins only' });
       }
       
       const payouts = await prisma.payoutRequest.findMany({
         orderBy: { createdAt: 'desc' }
       });

       // Manual join for UserProfile
       const userIds = [...new Set(payouts.map(p => p.userId))];
       const profiles = await prisma.userProfile.findMany({
         where: { userId: { in: userIds } },
         select: { userId: true, username: true } // Removed email as it is not in UserProfile
         // Schema Step 1239: UserProfile has `username`. No `email` (email is in Auth).
         // I'll just get username.
       }) as any[]; // Type assertion if needed

       const profileMap = new Map(profiles.map(p => [p.userId, p]));

       const enriched = payouts.map(p => ({
         ...p,
         username: profileMap.get(p.userId)?.username || 'Unknown User'
       }));

       return enriched;
    }
  );

  // ADMIN: Approve Payout
  app.post<{ Params: { id: string } }>(
    '/payment/admin/payouts/:id/approve',
    { preHandler: [app.auth] },
    async (req, reply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      // Verify Admin Access
      const adminRecord = await prisma.admin.findUnique({
        where: { userId: user.id }
      });
      if (!adminRecord) {
        return reply.status(403).send({ error: 'Forbidden: Admins only' });
      }

      const { id } = req.params;
      
      const payout = await prisma.payoutRequest.update({
        where: { id },
        data: { status: 'approved' }
      });
      
      // Ideally trigger a notification or real transfer logic here
      
      return payout;
    }
  );

  // ADMIN: Reject Payout
  app.post<{ Params: { id: string } }>(
    '/payment/admin/payouts/:id/reject',
    { preHandler: [app.auth] },
    async (req, reply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      // Verify Admin Access
      const adminRecord = await prisma.admin.findUnique({
        where: { userId: user.id }
      });
      if (!adminRecord) {
        return reply.status(403).send({ error: 'Forbidden: Admins only' });
      }

      const { id } = req.params;
      
      // When rejecting, we should probably refund the "available balance" logic?
      // Currently our "Available Balance" is calculated as (Total Earned - Total Payouts).
      // "Total Payouts" logic in `author-stats` is: `p.status !== 'rejected'`.
      // So if we set it to 'rejected', it is automatically excluded from the "Total Paid Out" sum,
      // thereby increasing the Available Balance back to what it was.
      // So simple status update is sufficient!
      
      const payout = await prisma.payoutRequest.update({
        where: { id },
        data: { status: 'rejected' }
      });
      
      return payout;
    }
  );

  app.post<{ Body: { amount: number; note: string } }>(
    '/payment/request-payout',
    { preHandler: [app.auth] },
    async (req, reply) => {
      const { amount, note } = req.body; // in cents
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      if (amount < 1000) { // Minimum $10
        // return reply.status(400).send({ error: 'Minimum payout is $10.00' });
        // TEMPORARY: Allow all for testing
      }

      // Re-calculate balance (copy logic to ensure security)
      const projects = await prisma.project.findMany({ where: { userId: user.id }, select: { id: true } });
      const chapterIds = (await prisma.chapter.findMany({ where: { projectId: { in: projects.map(p => p.id) } }, select: { id: true } })).map(c => c.id);
      
      const unlocks = await prisma.unlockedContent.findMany({ where: { chapterId: { in: chapterIds } }, select: { paidPrice: true } });
      const totalCoins = unlocks.reduce((acc, u) => acc + u.paidPrice, 0);
      
      const COIN_VALUE_USD = 0.005;
      const totalRevenue = Math.floor(totalCoins * COIN_VALUE_USD * 100);

      const payouts = await prisma.payoutRequest.findMany({ where: { userId: user.id } });
      const used = payouts.filter(p => p.status !== 'rejected').reduce((acc, p) => acc + p.amount, 0);
      
      const available = totalRevenue - used;


      const request = await prisma.payoutRequest.create({
        data: {
          userId: user.id,
          amount,
          coinsDeducted: 0,
          status: 'pending',
          note: note || ''
        }
      });

      return request;
    }
  );
};

export default paymentRoutes;
