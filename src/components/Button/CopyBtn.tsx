import * as React from "react";

import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import Tooltip from "@mui/material/Tooltip";
import type { SxProps, Theme } from "@mui/material/styles";

export default function CopyBtn(props: {
  content: string;
  className?: string;
  disableRipple?: boolean;
  sx?: SxProps<Theme>;
}) {
  const [isCopied, setIscopied] = React.useState(false);

  const copyContent = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(props.content);
        return true;
      }
    } catch (error) {
      console.error("Failed to copy with Clipboard API:", error);
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = props.content;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const didCopy = document.execCommand("copy");
      document.body.removeChild(textarea);
      return didCopy;
    } catch (error) {
      console.error("Failed to copy content:", error);
      return false;
    }
  };

  const handleCopiedState = () => {
    setIscopied(true);
    setTimeout(() => {
      setIscopied(false);
    }, 2000);
  };

  const handleClick = async () => {
    if (isCopied) {
      return;
    }
    const didCopy = await copyContent();
    if (didCopy) {
      handleCopiedState();
    }
  };

  return (
    <>
      <Tooltip title={isCopied ? "Copied!" : "Copy"}>
        <IconButton
          size="small"
          aria-label="copy"
          disableFocusRipple={props.disableRipple}
          disableRipple={props.disableRipple}
          onClick={handleClick}
          sx={[
            {
              position: "absolute",
              top: " 0.625rem",
              right: "0.625rem",
              background: "transparent",
              border: "unset",
            },
            ...(Array.isArray(props.sx)
              ? props.sx
              : props.sx
              ? [props.sx]
              : []),
          ]}
          className={props.className}
        >
          {isCopied ? (
            <CheckIcon fontSize="inherit" />
          ) : (
            <ContentCopyIcon fontSize="inherit" />
          )}
        </IconButton>
      </Tooltip>
    </>
  );
}
