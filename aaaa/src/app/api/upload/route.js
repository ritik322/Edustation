import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function POST(req) {
  try {
    console.log("Upload API hit");

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read file contents
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate safe file path (same file name)
    const filePath = path.join(uploadDir, file.name);
    await fs.writeFile(filePath, buffer);

    // Generate full URL
    const fileUrl = new URL(`/uploads/${file.name}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").href;

    return NextResponse.json({ url: fileUrl, filename: file.name });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
