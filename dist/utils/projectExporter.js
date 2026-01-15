"use strict";
/**
 * Project Exporter - Export project data to various formats
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportProjectAsJson = exportProjectAsJson;
exports.exportProjectAsMarkdown = exportProjectAsMarkdown;
exports.exportProjectAsText = exportProjectAsText;
const prisma_1 = require("../db/prisma");
/**
 * Export project data as JSON
 */
async function exportProjectAsJson(projectId, userId) {
    try {
        // Verify project ownership
        const project = await prisma_1.prisma.project.findFirst({
            where: { id: projectId, userId },
            select: {
                id: true,
                title: true,
                description: true,
                mode: true,
            },
        });
        if (!project) {
            throw new Error('Project not found');
        }
        // Fetch chapters
        const chapters = await prisma_1.prisma.chapter.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
            select: {
                title: true,
                content: true,
                createdAt: true,
            },
        });
        // Fetch characters
        const characters = await prisma_1.prisma.character.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
            select: {
                name: true,
                role: true,
                summary: true,
            },
        });
        // Fetch world settings
        const worldSettings = await prisma_1.prisma.worldSetting.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
            select: {
                name: true,
                summary: true,
            },
        });
        return {
            title: project.title,
            description: project.description || undefined,
            mode: project.mode || 'novel',
            chapters: chapters.map((ch) => ({
                title: ch.title,
                content: ch.content || '',
                createdAt: ch.createdAt?.toISOString() || new Date().toISOString(),
            })),
            characters: characters.map((char) => ({
                name: char.name,
                role: char.role || undefined,
                summary: char.summary || undefined,
            })),
            worldSettings: worldSettings.map((ws) => ({
                name: ws.name,
                summary: ws.summary || undefined,
            })),
            exportedAt: new Date().toISOString(),
        };
    }
    catch (err) {
        console.error('Error exporting project:', err);
        throw err;
    }
}
/**
 * Export project as markdown (for novel/text projects)
 */
async function exportProjectAsMarkdown(projectId, userId) {
    try {
        const data = await exportProjectAsJson(projectId, userId);
        let markdown = `# ${data.title}\n\n`;
        if (data.description) {
            markdown += `${data.description}\n\n`;
        }
        markdown += `**Mode:** ${data.mode}\n`;
        markdown += `**Exported:** ${new Date(data.exportedAt).toLocaleString()}\n\n`;
        // Characters section
        if (data.characters.length > 0) {
            markdown += `## Characters\n\n`;
            data.characters.forEach((char) => {
                markdown += `### ${char.name}\n`;
                if (char.role)
                    markdown += `**Role:** ${char.role}\n`;
                if (char.summary)
                    markdown += `${char.summary}\n`;
                markdown += `\n`;
            });
        }
        // World Settings section
        if (data.worldSettings.length > 0) {
            markdown += `## World Settings\n\n`;
            data.worldSettings.forEach((ws) => {
                markdown += `### ${ws.name}\n`;
                if (ws.summary)
                    markdown += `${ws.summary}\n`;
                markdown += `\n`;
            });
        }
        // Chapters section
        if (data.chapters.length > 0) {
            markdown += `## Chapters\n\n`;
            data.chapters.forEach((ch, idx) => {
                markdown += `### Chapter ${idx + 1}: ${ch.title}\n\n`;
                markdown += `${ch.content}\n\n`;
                markdown += `---\n\n`;
            });
        }
        return markdown;
    }
    catch (err) {
        console.error('Error exporting project as markdown:', err);
        throw err;
    }
}
/**
 * Export project as plain text
 */
async function exportProjectAsText(projectId, userId) {
    try {
        const data = await exportProjectAsJson(projectId, userId);
        let text = `${data.title}\n`;
        text += `${'='.repeat(data.title.length)}\n\n`;
        if (data.description) {
            text += `${data.description}\n\n`;
        }
        text += `Mode: ${data.mode}\n`;
        text += `Exported: ${new Date(data.exportedAt).toLocaleString()}\n\n`;
        // Characters section
        if (data.characters.length > 0) {
            text += `CHARACTERS\n${'-'.repeat(10)}\n\n`;
            data.characters.forEach((char) => {
                text += `${char.name}\n`;
                if (char.role)
                    text += `  Role: ${char.role}\n`;
                if (char.summary)
                    text += `  ${char.summary}\n`;
                text += `\n`;
            });
        }
        // World Settings section
        if (data.worldSettings.length > 0) {
            text += `\nWORLD SETTINGS\n${'-'.repeat(15)}\n\n`;
            data.worldSettings.forEach((ws) => {
                text += `${ws.name}\n`;
                if (ws.summary)
                    text += `  ${ws.summary}\n`;
                text += `\n`;
            });
        }
        // Chapters section
        if (data.chapters.length > 0) {
            text += `\nCHAPTERS\n${'-'.repeat(8)}\n\n`;
            data.chapters.forEach((ch, idx) => {
                text += `Chapter ${idx + 1}: ${ch.title}\n`;
                text += `${'-'.repeat(ch.title.length + 12)}\n\n`;
                text += `${ch.content}\n\n`;
                text += `${'-'.repeat(40)}\n\n`;
            });
        }
        return text;
    }
    catch (err) {
        console.error('Error exporting project as text:', err);
        throw err;
    }
}
//# sourceMappingURL=projectExporter.js.map