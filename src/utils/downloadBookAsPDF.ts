// downloadBookAsPDF.ts

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a PDF from the content of a specified HTML element.
 *
 * @param elementId The ID of the HTML element whose content should be converted.
 * @param filename The name of the PDF file to be downloaded (e.g., 'my_book.pdf').
 * @returns A Promise that resolves when the PDF is generated and downloaded, or rejects on error.
 */
export const downloadBookAsPDF = async (elementId: string, filename: string = 'book_content.pdf'): Promise<void> => {
    // 1. Get the HTML element to convert
    const input = document.getElementById(elementId);

    if (!input) {
        console.error(`Error: Element with ID "${elementId}" not found for PDF conversion.`);
        // You might want to throw an error here or return a rejected Promise
        throw new Error(`Content element not found: ${elementId}`);
    }

    // 2. Use html2canvas to render the HTML element into a canvas (image)
    try {
        const canvas = await html2canvas(input, {
            // Optional html2canvas configuration:
            scale: 2, // Increase scale for higher resolution (e.g., 2 for 2x resolution)
            useCORS: true, // Set to true if your HTML includes images from other domains
            logging: false, // Disable html2canvas logs
            allowTaint: true, // Required for cross-origin images without CORS headers
            // backgroundColor: '#ffffff', // Set a background color if your content has transparency
        });

        const imgData = canvas.toDataURL('image/png'); // Get image data as base64 PNG

        // 3. Create a new jsPDF document instance
        const pdf = new jsPDF({
            orientation: 'p', // 'p' for portrait, 'l' for landscape
            unit: 'mm',       // Units for measurement (millimeters)
            format: 'a4',     // Page format (A4)
        });

        // Calculate dimensions to fit the image on the PDF page
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // Calculate aspect ratio to fit the image while maintaining proportions
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const finalImgWidth = imgWidth * ratio;
        const finalImgHeight = imgHeight * ratio;

        // Adjust X-position to center the image horizontally on the page
        const xOffset = (pdfWidth - finalImgWidth) / 2;

        // 4. Handle multi-page content (if content is taller than one A4 page)
        let heightLeft = imgHeight; // Remaining height of the canvas image to be placed
        let position = 0;           // Current vertical position on the canvas for the next PDF page slice

        // Add the first page of the PDF
        // Image is placed at (xOffset, position) with calculated dimensions
        pdf.addImage(imgData, 'PNG', xOffset, position, finalImgWidth, finalImgHeight);
        heightLeft -= pdfHeight; // Decrease remaining height by one PDF page height (A4)

        // Loop to add more pages if the content is longer than the first page
        while (heightLeft > 0) {
            position = heightLeft * -1; // Calculate the vertical offset for the next part of the image.
                                        // This moves the "window" down the original canvas image.
            pdf.addPage(); // Add a new page to the PDF document
            // Add the image again, but with a negative Y offset (`position`)
            // to show the next "slice" of the original content on the new page.
            // Note: xOffset remains the same to keep image centered horizontally.
            pdf.addImage(imgData, 'PNG', xOffset, position, finalImgWidth, finalImgHeight);
            heightLeft -= pdfHeight; // Decrease remaining height by another PDF page height
        }

        // 5. Save the PDF (triggers download in the browser)
        pdf.save(filename);

        console.log(`PDF "${filename}" generated successfully from element "${elementId}"!`);

    } catch (error) {
        console.error(`Failed to generate PDF from element "${elementId}":`, error);
        // Re-throw or return a rejected Promise to propagate the error to the calling component
        throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
    }
};