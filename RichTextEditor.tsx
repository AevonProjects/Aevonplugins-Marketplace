"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, SmilePlus } from "lucide-react";

type Props = { value: string; onChange: (html: string) => void };

const emoji = ["✨","🔥","⚡","🛡️","⚔️","💎","🎮","✅","❌","📌","🔒","💰","🎁","🚀","❤️"];

export default function RichTextEditor({ value, onChange }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value; }, [value]);
  function cmd(command: string, arg?: string) { document.execCommand(command, false, arg); editor.current?.focus(); onChange(editor.current?.innerHTML || ""); }
  return <div className="richEditorShell">
    <div className="richToolbar">
      <button type="button" title="Bold" onClick={() => cmd("bold")}><Bold size={15}/></button>
      <button type="button" title="Italic" onClick={() => cmd("italic")}><Italic size={15}/></button>
      <button type="button" title="Underline" onClick={() => cmd("underline")}><Underline size={15}/></button>
      <select title="Font" defaultValue="" onChange={(e)=>{ if(e.target.value) cmd("fontName", e.target.value); e.currentTarget.value=""; }}>
        <option value="">Font</option><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Georgia">Georgia</option><option value="Trebuchet MS">Trebuchet</option><option value="Courier New">Courier</option>
      </select>
      <select title="Text size" defaultValue="" onChange={(e)=>{ if(e.target.value) cmd("fontSize", e.target.value); e.currentTarget.value=""; }}>
        <option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">XL</option><option value="6">XXL</option>
      </select>
      <label className="colorPicker">Text <input type="color" onChange={(e)=>cmd("foreColor",e.target.value)} /></label>
      <button type="button" title="Bulleted list" onClick={() => cmd("insertUnorderedList")}>• List</button>
      <button type="button" title="Numbered list" onClick={() => cmd("insertOrderedList")}>1. List</button>
      <button type="button" title="Remove formatting" onClick={() => cmd("removeFormat")}>Clear</button>
    </div>
    <div className="emojiBar"><SmilePlus size={14}/>{emoji.map(e=><button type="button" key={e} onClick={()=>cmd("insertText",e)}>{e}</button>)}</div>
    <div ref={editor} className="richEditor" contentEditable suppressContentEditableWarning onInput={(e)=>onChange(e.currentTarget.innerHTML)} data-placeholder="Write the full plugin description here…" />
  </div>;
}
