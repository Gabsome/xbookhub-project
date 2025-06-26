// src/utils/downloadBookAsPDF.ts
import { jsPDF } from 'jspdf';

/**
 * Generates a PDF from the content of a specified HTML element using jsPDF's HTML renderer.
 * This function includes robust client-side cleaning to remove images and problematic styles
 * before PDF generation, as a fallback if the backend's `cleanHtml` is not fully effective.
 *
 * @param elementId The ID of the HTML element whose content should be converted.
 * @param filename The name of the PDF file to be downloaded (e.g., 'my_book.pdf').
 * @returns A Promise that resolves when the PDF is generated and downloaded, or rejects on error.
 */
export const downloadBookAsPDF = async (elementId: string, filename: string = 'book_content.pdf'): Promise<void> => {
    const input = document.getElementById(elementId);

    if (!input) {
        console.error(`Error: Element with ID "${elementId}" not found for PDF conversion.`);
        throw new Error(`Content element not found: ${elementId}`);
    }

    // Store original styles to revert later
    const originalInputStylePosition = input.style.position;
    const originalInputStyleLeft = input.style.left;
    const originalInputStyleTop = input.style.top;
    const originalInputStyleVisibility = input.style.visibility;
    const originalInputStyleDisplay = input.style.display;
    const originalInputStyleOpacity = input.style.opacity;
    const originalInputStyleWidth = input.style.width;
    const originalInputStyleHeight = input.style.height; // Store original height
    const originalInputStylePadding = input.style.padding;
    const originalInputStyleBackgroundColor = input.style.backgroundColor;
    const originalInputStyleColor = input.style.color;
    const originalInputStyleFontSize = input.style.fontSize;
    const originalInputStyleLineHeight = input.style.lineHeight;
    const originalInputStyleFontFamily = input.style.fontFamily;
    const originalInputStyleOverflow = input.style.overflow;
    const originalInputStyleBoxSizing = input.style.boxSizing;

    // Temporarily make the element "visible" to the DOM parser but invisible to the user
    // These styles are crucial for html2canvas to correctly measure and render the element.
    input.style.position = 'absolute';
    input.style.left = '0px';
    input.style.top = '0px';
    input.style.visibility = 'visible'; // Must be 'visible' for html2canvas to render
    input.style.display = 'block';
    input.style.opacity = '0.01'; // Very low opacity to hide from user

    // Apply print-friendly styles for rendering within the PDF
    // These ensure html2canvas renders the content in a predictable layout
    input.style.width = '210mm'; // A4 width
    input.style.height = 'auto'; // Allow height to expand based on content
    input.style.padding = '20mm'; // Simulate page margins
    input.style.boxSizing = 'border-box';
    input.style.backgroundColor = '#ffffff'; // Ensure white background
    input.style.color = '#000000'; // Ensure black text
    input.style.fontSize = '12pt'; // Standard readable font size
    input.style.lineHeight = '1.5'; // Standard line spacing
    input.style.fontFamily = 'serif'; // Generic serif font for readability
    input.style.overflow = 'visible'; // Crucial: allow content to overflow if needed, html2canvas will capture it

    try {
        console.log(`[downloadBookAsPDF] Attempting to render element "${elementId}" to PDF using jsPDF.html()...`);

        const pdf = new jsPDF({
            orientation: 'p', // Portrait
            unit: 'mm', // Millimeters
            format: 'a4', // A4 paper size
        });

        // Use jsPDF's html method for better HTML parsing and rendering.
        // It uses html2canvas internally for rendering, but provides more control.
        await pdf.html(input, {
            callback: function (doc) {
                console.log(`PDF "${filename}" generated successfully from element "${elementId}"!`);
                doc.save(filename); // Save the generated PDF
            },
            x: 0, // X-coordinate for content placement (relative to margins)
            y: 0, // Y-coordinate for content placement (relative to margins)
            margin: [20, 20, 20, 20], // Top, Right, Bottom, Left margins in mm
            autoPaging: 'slice', // Automatically split content across pages if it overflows
            // Options passed directly to html2canvas, which is used by jsPDF.html()
            html2canvas: {
                scale: 2, // Increase resolution for better text clarity in PDF
                useCORS: false, // Set to false to avoid issues with images that might still be in HTML but aren't
                                // served with proper CORS headers. We expect images to be stripped by backend.
                allowTaint: false, // Prevents html2canvas from "tainting" the canvas if cross-origin content is detected.
                                  // Since we're stripping images, this should be safe.
                logging: false, // Disable verbose html2canvas logging
                foreignObjectRendering: false, // Disable for potentially better stability with simple HTML content
                backgroundColor: '#FFFFFF', // Explicitly set background color for the canvas rendering
                // *** CRUCIAL: onclone callback for aggressive client-side cleaning ***
                // This function runs on the cloned DOM before html2canvas renders it.
                // It's the ultimate safety net if backend cleaning is imperfect.
                onclone: (clonedDoc: Document) => {
                    console.log('[downloadBookAsPDF] onclone: Starting aggressive client-side HTML sanitization...');

                    // 1. Remove all <img> tags
                    clonedDoc.querySelectorAll('img').forEach(img => {
                        console.log(`[downloadBookAsPDF] onclone: Removing img tag with src: ${img.src}`);
                        img.remove();
                    });

                    // 2. Remove elements with `background-image` style
                    // This covers inline styles and potentially computed styles if a stylesheet provides it.
                    clonedDoc.querySelectorAll('*').forEach(element => {
                        if (element instanceof HTMLElement) {
                            // Clear inline style
                            if (element.style.backgroundImage) {
                                console.log(`[downloadBookAsPDF] onclone: Clearing inline background-image from element: ${element.tagName}`);
                                element.style.backgroundImage = 'none';
                            }
                            // More robust: For external stylesheets, you'd need to remove/disable the stylesheets,
                            // or add a new style rule to override. For now, focus on inline and attributes.
                        }
                        // Also remove any `data-html2canvas-ignore` attributes if they somehow persist
                        // (though not directly related to image cleaning, good for general robustness)
                        element.removeAttribute('data-html2canvas-ignore');
                    });

                    // 3. Remove script and style tags (they shouldn't be in the content div for PDF anyway)
                    clonedDoc.querySelectorAll('script, style').forEach(el => {
                        console.log(`[downloadBookAsPDF] onclone: Removing problematic tag: ${el.tagName}`);
                        el.remove();
                    });

                    // 4. Remove other potentially problematic or irrelevant tags for text-only PDF
                    // This is a more aggressive cleanup. Adjust as needed if you require specific non-text elements.
                    clonedDoc.querySelectorAll('iframe, svg, video, audio, form, input, button, select, textarea').forEach(el => {
                        console.log(`[downloadBookAsPDF] onclone: Removing interactive/media tag: ${el.tagName}`);
                        el.remove();
                    });

                    // 5. Clean up any remaining `src` or `srcset` attributes to prevent any ghost loading attempts
                    clonedDoc.querySelectorAll('[src], [srcset]').forEach(el => {
                        // Only target elements that could *still* load external content (e.g., if a non-img tag had src)
                        // This might be redundant if previous steps were thorough, but adds safety.
                        if (el instanceof HTMLImageElement || el instanceof HTMLSourceElement || el instanceof HTMLScriptElement) {
                             // Already handled imgs and scripts. This is mostly for fallback.
                        } else {
                            if (el.hasAttribute('src')) {
                                console.log(`[downloadBookAsPDF] onclone: Removing src attribute from ${el.tagName}`);
                                el.removeAttribute('src');
                            }
                            if (el.hasAttribute('srcset')) {
                                console.log(`[downloadBookAsPDF] onclone: Removing srcset attribute from ${el.tagName}`);
                                el.removeAttribute('srcset');
                            }
                        }
                    });

                    // 6. Remove all inline `style` attributes to strip any remaining formatting
                    clonedDoc.querySelectorAll('*').forEach(element => {
                        if (element instanceof HTMLElement) {
                            if (element.hasAttribute('style')) {
                                // console.log(`[downloadBookAsPDF] onclone: Removing inline style from ${element.tagName}`);
                                element.removeAttribute('style');
                            }
                        }
                    });

                    console.log('[downloadBookAsPDF] onclone: Cloned document fully sanitized for PDF rendering.');
                },
            },
        });

    } catch (error) {
        console.error(`Failed to generate PDF from element "${elementId}":`, error);
        throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
    } finally {
        // *** IMPORTANT: Revert temporary styles back to original state ***
        // This ensures the element does not interfere with the main page layout after PDF generation.
        input.style.position = originalInputStylePosition;
        input.style.left = originalInputStyleLeft;
        input.style.top = originalInputStyleTop;
        input.style.visibility = originalInputStyleVisibility;
        input.style.display = originalInputStyleDisplay;
        input.style.opacity = originalInputStyleOpacity;
        input.style.width = originalInputStyleWidth;
        input.style.height = originalInputStyleHeight;
        input.style.padding = originalInputStylePadding;
        input.style.backgroundColor = originalInputStyleBackgroundColor;
        input.style.color = originalInputStyleColor;
        input.style.fontSize = originalInputStyleFontSize;
        input.style.lineHeight = originalInputStyleLineHeight;
        input.style.fontFamily = originalInputStyleFontFamily;
        input.style.overflow = originalInputStyleOverflow;
        input.style.boxSizing = originalInputStyleBoxSizing;
    }
};