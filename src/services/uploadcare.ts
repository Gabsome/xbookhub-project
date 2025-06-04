import { Widget } from 'uploadcare-widget';

// Initialize Uploadcare
export const initUploadcare = () => {
  // Ensure the uploadcare script is loaded
  if (!document.getElementById('uploadcare-script')) {
    const script = document.createElement('script');
    script.id = 'uploadcare-script';
    script.src = 'https://ucarecdn.com/libs/widget/3.x/uploadcare.full.min.js';
    document.body.appendChild(script);
  }
};

// Create an Uploadcare widget
export const createUploadcareWidget = (element: HTMLElement, options = {}) => {
  return Widget(element, {
    publicKey: 'cb2ddbdec0cd01373ea6',
    imagesOnly: true,
    previewStep: true,
    ...options,
  });
};

// Upload a file and get its URL
export const uploadFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const widget = Widget.create({
      publicKey: 'cb2ddbdec0cd01373ea6',
      imagesOnly: true,
      previewStep: true,
    });

    widget.value(file).then(
      (fileInfo) => {
        resolve(fileInfo.cdnUrl);
      },
      (error) => {
        reject(error);
      }
    );
  });
};

// Save file URL to user profile (in localStorage for demo)
export const saveFileToUserProfile = (userId: string, fileUrl: string, type: string): void => {
  const userFiles = getUserFiles(userId);
  userFiles.push({
    url: fileUrl,
    type,
    addedAt: new Date().toISOString()
  });
  
  localStorage.setItem(`xbook-files-${userId}`, JSON.stringify(userFiles));
};

// Get all files for a user
export const getUserFiles = (userId: string): Array<{ url: string, type: string, addedAt: string }> => {
  const files = localStorage.getItem(`xbook-files-${userId}`);
  return files ? JSON.parse(files) : [];
};