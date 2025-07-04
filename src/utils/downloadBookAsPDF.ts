import { API_BASE_URL } from '../services/api';

/**
 * Generates and downloads a PDF by sending the content URL to the backend service.
 *
 * @param contentUrl The URL of the HTML content to convert to PDF.
 * @param title The title of the book for the PDF metadata.
 * @param author The author of the book for the PDF metadata.
 * @param filename The desired filename for the downloaded PDF.
 */
const downloadBookAsPDF = async (contentUrl: string, title: string, author: string, filename:string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-pdf-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: contentUrl, title, author }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Failed to generate PDF on the server.');
      } catch (e) {
        throw new Error(`Server responded with status ${response.status}: ${errorText.substring(0, 200)}...`);
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Error generating or downloading PDF via server:", error);
    throw error;
  }
};

export default downloadBookAsPDF;