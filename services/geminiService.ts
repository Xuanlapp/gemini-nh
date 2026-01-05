
import { GoogleGenAI } from "@google/genai";
import { ImageFile } from "../types";

export const generatePodImage = async (
  images: ImageFile[], 
  customPrompt?: string, 
  sourceImageBase64?: string,
  isPro: boolean = true
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Model mapping theo yêu cầu
  const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  let parts: any[] = [];

  if (sourceImageBase64) {
    parts.push({
      inlineData: {
        data: sourceImageBase64.split(',')[1],
        mimeType: 'image/png',
      },
    });
  } else {
    parts = images.map(img => ({
      inlineData: {
        data: img.base64.split(',')[1],
        mimeType: img.file.type || 'image/png',
      },
    }));
  }

  const defaultPrompt = `
    Nhiệm vụ: Bạn là một nhà thiết kế Graphic Design chuyên nghiệp cho thị trường Print on Demand (POD).
    Hãy phân tích các mẫu thiết kế và tạo ra một TÁC PHẨM NGHỆ THUẬT (WORKART) mới, độc bản.
    
    YÊU CẦU KỸ THUẬT QUAN TRỌNG:
    - NỀN ĐEN TUYỆT ĐỐI (#000000) - Điều này cực kỳ quan trọng để người dùng dễ dàng lọc màu đen (knockout black).
    - KHÔNG Mockup, KHÔNG có người mẫu, KHÔNG có vật dụng trưng bày.
    - Chỉ tập trung vào ASSET ĐỒ HỌA 2D hoặc ILLUSTRATION sạch sẽ.
    - Đường nét (Outlines) phải cực kỳ sắc nét, rõ ràng, phân tách hoàn toàn với nền đen.
    - Sử dụng các màu sắc rực rỡ, độ tương phản cực cao so với nền đen để họa tiết nổi bật hoàn toàn.
    - Độ chi tiết cao (High-detail), phong cách Digital Art chuyên nghiệp cho áo thun, cốc, mũ.
  `;

  const finalPrompt = sourceImageBase64 
    ? `Dựa trên thiết kế này, hãy tinh chỉnh: ${customPrompt}. Giữ đúng phong cách POD artwork, NỀN ĐEN 100%, họa tiết sắc nét để tách nền dễ dàng, độ phân giải cực cao.`
    : (customPrompt || defaultPrompt);

  try {
    // Chỉ thêm imageSize nếu là model Pro (gemini-3-pro-image-preview)
    const imageConfig: any = {
      aspectRatio: "1:1"
    };
    
    if (isPro) {
      imageConfig.imageSize = "2K";
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [...parts, { text: finalPrompt }],
      },
      config: {
        imageConfig
      }
    });

    let base64Image = "";
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!base64Image) throw new Error("AI không trả về kết quả ảnh.");
    return base64Image;
  } catch (error: any) {
    if (error.message.includes("Requested entity was not found")) {
      throw new Error("PRO_KEY_REQUIRED: Vui lòng kết nối API Key trả phí để sử dụng model Pro.");
    }
    throw new Error("Lỗi Generation: " + error.message);
  }
};
