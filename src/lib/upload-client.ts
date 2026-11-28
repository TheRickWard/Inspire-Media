// Upload a file straight to storage using a one-off link from the website, with progress.
export function uploadToSignedUrl(url: string, file: File, contentType: string, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was refused. Please check the file type and size.")));
    xhr.onerror = () => reject(new Error("The upload stopped. Please check your internet connection and try again."));
    xhr.send(file);
  });
}
