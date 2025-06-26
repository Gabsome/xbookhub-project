import { jsPDF } from 'jspdf';
// html2canvas import is removed as requested

/**
 * Generates a PDF from the content of a specified HTML element using jsPDF's HTML renderer.
 * NOTE: jsPDF's HTML rendering is limited and may not perfectly replicate complex CSS layouts or embedded resources.
 * It is best suited for simple, text-heavy HTML. Images might not render correctly or at all.
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
    // These styles are crucial for ensuring jsPDF's .html() method can correctly parse the DOM
    // and that the element is "visible" to it, even if hidden from the user.
    const originalInputStylePosition = input.style.position;
    const originalInputStyleLeft = input.style.left;
    const originalInputStyleTop = input.style.top;
    const originalInputStyleVisibility = input.style.visibility;
    const originalInputStyleDisplay = input.style.display;
    const originalInputStyleOpacity = input.style.opacity;
    // We can still set general print-friendly styles for consistency,
    // though jsPDF's parser might not use all of them.
    const originalInputStyleWidth = input.style.width;
    const originalInputStylePadding = input.style.padding;
    const originalInputStyleBackgroundColor = input.style.backgroundColor;
    const originalInputStyleColor = input.style.color;
    const originalInputStyleFontSize = input.style.fontSize;
    const originalInputStyleLineHeight = input.style.lineHeight;
    const originalInputStyleFontFamily = input.style.fontFamily;
    const originalInputStyleOverflow = input.style.overflow;
    const originalInputStyleBoxSizing = input.style.boxSizing;
    const originalInputStyleHeight = input.style.height;

    // Temporarily make the element "visible" and on-screen for jsPDF.html() to correctly parse
    // A very low opacity makes it invisible to the user but visible to the DOM parser.
    input.style.position = 'absolute';
    input.style.left = '0px';
    input.style.top = '0px';
    input.style.visibility = 'visible'; // Must be 'visible' for jsPDF.html to work reliably
    input.style.display = 'block';
    input.style.opacity = '0.01'; // Almost transparent, but still considered rendered

    // Apply print-friendly styles that jsPDF might respect to some degree
    // These help define the "page" dimensions and default text styles for jsPDF's parser.
    input.style.width = '210mm'; // A4 width
    input.style.height = 'auto'; // Allow content to dictate height, jsPDF will paginate
    input.style.padding = '20mm'; // Simulate page margins
    input.style.boxSizing = 'border-box'; // Include padding in the width calculation
    input.style.backgroundColor = '#ffffff'; // Ensure white background
    input.style.color = '#000000'; // Ensure black text
    input.style.fontSize = '12pt';
    input.style.lineHeight = '1.5';
    input.style.fontFamily = 'serif'; // Or 'sans-serif' as per your design
    input.style.overflow = 'visible'; // Ensure content isn't clipped before parsing

    try {
        console.log(`[downloadBookAsPDF] Attempting to render element "${elementId}" directly to PDF using jsPDF.html()...`);

        const pdf = new jsPDF({
            orientation: 'p', // Portrait
            unit: 'mm',       // Millimeters
            format: 'a4',     // A4 page size
        });

        // Use jsPDF's html method to convert HTML directly.
        // This is the core change: it takes the HTML element and tries to render it.
        await pdf.html(input, {
            callback: function (doc) {
                console.log(`PDF "${filename}" generated successfully from element "${elementId}"!`);
                doc.save(filename);
            },
            // Positioning for the HTML content within the PDF page.
            // Using 0,0 and letting margins handle spacing.
            x: 0,
            y: 0,
            // You can specify margins here, which will override the element's padding
            // or work in conjunction with it, depending on jsPDF's internal logic.
            // It's often simpler to manage margins here for consistent page layout.
            margin: [20, 20, 20, 20], // Top, Right, Bottom, Left margins in mm
            autoPaging: 'slice', // Attempts to automatically paginate content that exceeds one page
            // Optional: If you find `jsPDF.html` still tries to use `html2canvas` internally
            // and causes issues, you might try to set `html2canvas: { enabled: false }`.
            // However, this might also disable rendering of some complex elements that
            // jsPDF *relies* on html2canvas for, potentially leading to missing content.
            // For true "no html2canvas", the input HTML must be very, very simple.
            // For now, let's omit the `html2canvas` option to let jsPDF use its defaults.
        });

    } catch (error) {
        console.error(`Failed to generate PDF from element "${elementId}":`, error);
        throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
    } finally {
        // Revert temporary styles back to original state
        input.style.position = originalInputStylePosition;
        input.style.left = originalInputStyleLeft;
        input.style.top = originalInputStyleTop;
        input.style.visibility = originalInputStyleVisibility;
        input.style.display = originalInputStyleDisplay;
        input.style.opacity = originalInputStyleOpacity;
        input.style.width = originalInputStyleWidth;
        input.style.padding = originalInputStylePadding;
        input.style.backgroundColor = originalInputStyleBackgroundColor;
        input.style.color = originalInputStyleColor;
        input.style.fontSize = originalInputStyleFontSize;
        input.style.lineHeight = originalInputStyleLineHeight;
        input.style.fontFamily = originalInputStyleFontFamily;
        input.style.overflow = originalInputStyleOverflow;
        input.style.boxSizing = originalInputStyleBoxSizing;
        input.style.height = originalInputStyleHeight;
    }
};