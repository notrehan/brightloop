"use client";
import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
export function ProductImagePicker() {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="image-picker">
    {preview ? <div className="image-preview"><img src={preview} alt="Selected product preview"/><button type="button" className="image-remove" aria-label="Remove image" onClick={() => { URL.revokeObjectURL(preview); setPreview(""); setFileName(""); const input=document.getElementById("product-image") as HTMLInputElement|null; if(input) input.value=""; }}><X size={15}/></button></div> : <label className="image-dropzone" htmlFor="product-image"><ImagePlus size={22}/><strong>Add product image</strong><em>Choose file</em></label>}
    <input id="product-image" className="image-file-input" type="file" name="image" accept="image/png,image/jpeg,image/webp" onChange={e => { const file=e.target.files?.[0]; if(file){setPreview(URL.createObjectURL(file));setFileName(file.name);} }} />
    {fileName&&<p className="image-file-name">{fileName}</p>}
  </div>;
}
