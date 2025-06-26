import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a PDF from the content of a specified HTML element.
 * Assumes the HTML content provided to the element is text-only or pre-processed.
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
    const originalInputStyleWidth = input.style.width;
    const originalInputStylePadding = input.style.padding;
    const originalInputStyleBackgroundColor = input.style.backgroundColor;
    const originalInputStyleColor = input.style.color;
    const originalInputStyleFontSize = input.style.fontSize;
    const originalInputStyleLineHeight = input.style.lineHeight;
    const originalInputStyleFontFamily = input.style.fontFamily;
    const originalInputStyleOverflow = input.style.overflow;

    // Apply temporary print-friendly styles directly to the element being captured
    // This ensures consistent layout for the PDF, treating it like a page.
    input.style.width = '210mm'; // A4 width
    input.style.height = 'auto'; // Allow height to expand
    input.style.padding = '20mm'; // Simulate page margins
    input.style.boxSizing = 'border-box'; // Include padding in the width/height calculation
    input.style.backgroundColor = '#ffffff'; // Ensure white background
    input.style.color = '#000000'; // Ensure black text
    input.style.fontSize = '12pt';
    input.style.lineHeight = '1.5';
    input.style.fontFamily = 'serif'; // Or 'sans-serif', based on desired print style
    input.style.overflow = 'visible'; // Ensure all content is captured, not clipped

    try {
        const canvas = await html2canvas(input, {
            scale: 2, // Increase scale for higher resolution text
            useCORS: false, // Set to false as we expect text-only content (no external images)
            allowTaint: false, // Not needed if no cross-origin images
            logging: false, // Disable html2canvas logs for production
            // Ensure proper scrolling/positioning for multi-page content
            scrollY: -window.scrollY,
            scrollX: -window.scrollX,
            windowWidth: document.documentElement.offsetWidth,
            windowHeight: document.documentElement.offsetHeight,
        });

        const imgData = canvas.toDataURL('image/png'); // Get image data as base64 PNG

        const pdf = new jsPDF({
            orientation: 'p', // Portrait
            unit: 'mm',       // Millimeters
            format: 'a4',     // A4 page size
        });

        const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
        const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

        // Calculate image dimensions to fit the PDF page, maintaining aspect ratio
        const imgCanvasWidth = canvas.width;
        const imgCanvasHeight = canvas.height;

        const ratio = Math.min(pdfWidth / imgCanvasWidth, pdfHeight / imgCanvasHeight);
        const finalImgWidth = imgCanvasWidth * ratio;
        const finalImgHeight = imgCanvasHeight * ratio;

        // Adjust X-position to center the image horizontally on the page
        const xOffset = (pdfWidth - finalImgWidth) / 2;

        let heightLeft = finalImgHeight; // Remaining height of the scaled image
        let position = 0; // Current vertical position on the PDF page

        // Add the first page of the PDF
        pdf.addImage(imgData, 'PNG', xOffset, position, finalImgWidth, finalImgHeight);
        heightLeft -= pdfHeight;

        // Add subsequent pages if the content spans multiple pages
        while (heightLeft > 0) {
            position = heightLeft * -1; // Negative position shifts the image up on the canvas to show next slice
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', xOffset, position + pdfHeight, finalImgWidth, finalImgHeight); // Adjusted position for multi-page
            heightLeft -= pdfHeight;
        }

        pdf.save(filename);
        console.log(`PDF "${filename}" generated successfully from element "${elementId}"!`);

    } catch (error) {
        console.error(`Failed to generate PDF from element "${elementId}":`, error);
        throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
    } finally {
        // Revert temporary styles back to original (or empty if not set)
        input.style.width = originalInputStyleWidth;
        input.style.padding = originalInputStylePadding;
        input.style.backgroundColor = originalInputStyleBackgroundColor;
        input.style.color = originalInputStyleColor;
        input.style.fontSize = originalInputStyleFontSize;
        input.style.lineHeight = originalInputStyleLineHeight;
        input.style.fontFamily = originalInputStyleFontFamily;
        input.style.overflow = originalInputStyleOverflow;
    }
};
