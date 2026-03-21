/**
 * Utility to collect all CSS rules from the current document to be used in PDF generation.
 * This is more robust than just selecting <style> tags as it handles rules from <link> 
 * and injected styles (like Tailwind JIT).
 */
export const getReportStyles = () => {
    let css = '';
    
    try {
        const styleSheets = Array.from(document.styleSheets);
        
        for (const sheet of styleSheets) {
            try {
                // If it's a same-origin sheet or a style tag, we can read rules
                const rules = sheet.cssRules || sheet.rules;
                if (rules) {
                    for (const rule of Array.from(rules)) {
                        css += rule.cssText + '\n';
                    }
                }
            } catch {
                // Security error for cross-origin sheets (like CDNs)
                // Fallback to getting innerText if it's a style tag we can't read rules from for some reason
                if (sheet.ownerNode && sheet.ownerNode.tagName === 'STYLE') {
                    css += sheet.ownerNode.innerText + '\n';
                }
                // We keep going for other sheets
            }
        }
    } catch {
        console.error('Error collecting report styles');
    }
    
    return css;
};
