import { proxy, useSnapshot } from "valtio";

class InputImageState {
  public previewImage: string = "";
  public base64Image: string = "";
  public fileUrl: string = "";

  get PreViewImage() {
    return this.previewImage;
  }

  public UpdateBase64Image(image: string) {
    this.base64Image = image;
  }

  public Reset() {
    this.previewImage = "";
    this.base64Image = "";
    this.fileUrl = "";
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject("Error converting file to base64");
        }
      };
    });
  }

  public async OnFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // Client-side validation
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        alert('Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.');
        event.target.value = ''; // Reset input
        return;
      }

      if (file.size > maxSize) {
        alert('Image size exceeds 5MB limit.');
        event.target.value = ''; // Reset input
        return;
      }

      try {
        const base64 = await this.fileToBase64(file);
        const url = URL.createObjectURL(file);
        this.previewImage = url;
        this.base64Image = base64;
        this.fileUrl = file.name;
      } catch (error) {
        alert('Failed to process image. Please try again.');
        event.target.value = ''; // Reset input
      }
    }
  }
}

export const InputImageStore = proxy(new InputImageState());

export const useInputImage = () => {
  return useSnapshot(InputImageStore, { sync: true });
};
