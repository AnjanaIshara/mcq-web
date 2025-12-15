import { Option } from './types'; 

export function clampExpectedSelections(options: Option[], requested: number): number { 
    const max = Math.max(1, options.length || 1); 
    if (requested < 1) return 1; 
    if (requested > max) return max; 
    return requested; 
} 

export function toggleSelection( 
    current: string[], 
    optionId: string, 
    maxSelections: number 
): string[] { 
    if (current.includes(optionId)) { 
        return current.filter((id) => id !== optionId);
    } 
    
    if (current.length >= maxSelections) { 
        return current; 
    } 
    return [...current, optionId]; 
}