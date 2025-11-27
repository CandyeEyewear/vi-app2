// utils/slug.ts
export function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-')       // Remove duplicate hyphens
      .substring(0, 60);         // Limit length
  }
  
  // Add random suffix to ensure uniqueness
  export function generateUniqueSlug(title: string): string {
    const baseSlug = generateSlug(title);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${baseSlug}-${randomSuffix}`;
  }
 