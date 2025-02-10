import { storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
      });
    }

    const buffer = await file.arrayBuffer();
    const fileRef = ref(storage, `uploads/${file.name}`);
    await uploadBytes(fileRef, buffer);

    const downloadURL = await getDownloadURL(fileRef);

    return new Response(JSON.stringify({ url: downloadURL }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
