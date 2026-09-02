"use client";

import Switch, { type SwitchProps } from "@mui/material/Switch";
import { alpha, styled } from "@mui/material/styles";

// The iOS pill toggle, in the app's own colours: the accent carries "on", the
// rule colour carries "off". Sized down from Apple's 51x31 to 42x24 so a grid
// of them stays dense enough to scan a whole row at once.
const IOSSwitch = styled((props: SwitchProps) => (
  <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  const on = theme.palette.success.main;
  const off = theme.palette.error.main;

  return {
    width: 42,
    height: 24,
    padding: 0,
    overflow: "visible",
    "& .MuiSwitch-switchBase": {
      padding: 0,
      margin: 2,
      transitionDuration: "200ms",
      "&.Mui-checked": {
        transform: "translateX(18px)",
        "& .MuiSwitch-thumb": { backgroundColor: "#FFFFFF" },
        "& + .MuiSwitch-track": {
          backgroundColor: on,
          opacity: 1,
          border: 0,
        },
        "&.Mui-disabled + .MuiSwitch-track": { opacity: 0.45 },
      },
      "&.Mui-focusVisible .MuiSwitch-thumb": {
        boxShadow: `0 0 0 3px ${alpha(on, 0.45)}`,
      },
      "&.Mui-disabled + .MuiSwitch-track": { opacity: 0.45 },
      "&.Mui-disabled .MuiSwitch-thumb": { opacity: 0.75 },
    },
    "& .MuiSwitch-thumb": {
      boxSizing: "border-box",
      width: 20,
      height: 20,
      backgroundColor: dark ? "#CFC7D4" : "#FFFFFF",
      boxShadow: dark
        ? "0 1px 2px rgba(0,0,0,0.6)"
        : "0 1px 2px rgba(26,23,20,0.28)",
    },
    "& .MuiSwitch-track": {
      borderRadius: 12,
      backgroundColor: dark ? "#3A3442" : off,
      opacity: 1,
      transition: theme.transitions.create(["background-color"], {
        duration: 220,
      }),
    },
  };
});

export default IOSSwitch;
