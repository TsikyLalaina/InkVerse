import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://inkverseapp.com'; // Replace with actual domain

  // Static routes
  const routes = [
    '',
    '/explore',
    '/feedback',
    '/auth/login',
    '/auth/signup',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Potential for dynamic routes here (e.g., fetch from DB)
  // const projects = await prisma.project.findMany({ where: { visibility: 'public' } });
  
  return [...routes];
}
