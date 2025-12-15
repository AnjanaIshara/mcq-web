import { describe, expect, it } from 'vitest'; 
import { clampExpectedSelections, toggleSelection } from './logic'; 

const options = [ 
    { id: 'a', text: 'A' }, 
    { id: 'b', text: 'B' }, 
    { id: 'c', text: 'C' } 
]; 

describe('clampExpectedSelections', () => { 
    it('keeps value within 1..options length', () => { 
        expect(clampExpectedSelections(options, 0)).toBe(1); 
        expect(clampExpectedSelections(options, 2)).toBe(2); 
        expect(clampExpectedSelections(options, 5)).toBe(3); 
    }); 
    
    it('handles empty options safely', () => { 
        expect(clampExpectedSelections([], 3)).toBe(1); 
    }); 
}); 
describe('toggleSelection', () => { 
    it('adds when under limit', () => { 
        expect(toggleSelection([], 'a', 2)).toEqual(['a']); 
    }); 
    
    it('removes when already selected', () => { 
        expect(toggleSelection(['a'], 'a', 2)).toEqual([]); 
    }); 
    
    it('blocks when at limit', () => { 
        expect(toggleSelection(['a', 'b'], 'c', 2)).toEqual(['a', 'b']); 
    }); 
});