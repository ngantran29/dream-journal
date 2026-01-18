import React from 'react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  textareaRef,
}) => {
  return (
    <textarea
      id="prompt"
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Describe how you want to generate your image(s)..."
      className="w-full min-h-[120px] rounded-md border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
};

export default PromptInput;
