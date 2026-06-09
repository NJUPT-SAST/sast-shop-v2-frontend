import jsQR from "jsqr";

const MAX_QR_IMAGE_BYTES = 5 * 1024 * 1024;

export async function decodePaymentQrImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片格式的二维码");
  }

  if (file.size > MAX_QR_IMAGE_BYTES) {
    throw new Error("二维码图片不能超过 5MB");
  }

  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (width <= 0 || height <= 0) {
    throw new Error("图片读取失败，请换一张清晰图片");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器无法读取图片，请换用其他浏览器");
  }

  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  const content = result?.data.trim();

  if (!content) {
    throw new Error("未识别到二维码，请换一张清晰图片");
  }

  return content;
}

function loadImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("图片读取失败，请换一张清晰图片"));
    };
    image.src = imageUrl;
  });
}
