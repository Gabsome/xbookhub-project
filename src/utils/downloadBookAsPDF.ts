import html2canvas from 'html2canvas'; // Import html2canvas
import jsPDF from 'jspdf';             // Import jsPDF

/**
 * Generates and downloads a PDF from a specified HTML element.
 *
 * @param elementId The ID of the HTML element to convert to PDF.
 * @param filename The desired filename for the downloaded PDF (e.g., "my-document.pdf").
 */
const downloadBookAsPDF = async (elementId: string, filename: string): Promise<void> => {
  const input = document.getElementById(elementId);

  if (!input) {
    console.error(`Element with ID '${elementId}' not found.`);
    return;
  }

  try {
    // 1. Capture the HTML element as a canvas image
    const canvas = await html2canvas(input, {
      scale: 2, // Increase scale for better resolution in PDF
      useCORS: true, // If your element contains images from other origins
    });

    // 2. Convert the canvas to a data URL (PNG format)
    const imgData = canvas.toDataURL('image/png');

    // 3. Initialize jsPDF
    const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for paper size

    const imgWidth = 210; // A4 width in mm (210mm)
    const pageHeight = 297; // A4 height in mm (297mm)

    // Calculate the height of the image based on its aspect ratio and the desired width
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Add the first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add subsequent pages if the content is taller than one A4 page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight; // Calculate position for the next part of the image
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 4. Save the PDF
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  } catch (error) {
    console.error("Error generating or downloading PDF:", error);
  }
};

export default downloadBookAsPDF;