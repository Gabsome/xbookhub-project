import { API_BASE_URL } from '../services/api';

const downloadBookAsPDF = async (contentUrl: string, title: string, author: string, filename: string): Promise<void> => {
  try {
    console.log(`Requesting PDF generation for: ${contentUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large books
    
    const response = await fetch(`${API_BASE_URL}/api/generate-pdf-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: contentUrl, 
        title: title || 'Unknown Title', 
        author: author || 'Unknown Author' 
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to generate PDF on the server.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        
        if (errorData.details) {
          errorMessage += ` Details: ${errorData.details}`;
        }
      } catch (e) {
        const errorText = await response.text();
        errorMessage = `Server responded with status ${response.status}: ${errorText.substring(0, 200)}`;
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    
    if (blob.type !== 'application/pdf' && !response.headers.get('content-type')?.includes('application/pdf')) {
      throw new Error('Server did not return a valid PDF file');
    }

    if (blob.size === 0) {
      throw new Error('Server returned an empty PDF file');
    }

    // Clean filename for better compatibility
    const cleanFilename = filename
      .replace(/[^a-zA-Z0-9\s\-_\.]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFilename.endsWith('.pdf') ? cleanFilename : `${cleanFilename}.pdf`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
    
    console.log(`PDF downloaded successfully: ${cleanFilename} (${blob.size} bytes)`);

  } catch (error) {
    console.error("Error generating or downloading PDF via server:", error);
    
    if (error.name === 'AbortError') {
      throw new Error('PDF generation timed out. Large books may take several minutes to process. Please try again or try downloading as TXT/HTML instead.');
    }
    
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

export default downloadBookAsPDF;