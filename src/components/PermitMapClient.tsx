"use client";

import dynamic from "next/dynamic";

const PermitMapInner = dynamic(() => import("./PermitMap"), { ssr: false });

export default function PermitMapClient(props: React.ComponentProps<typeof PermitMapInner>) {
  return <PermitMapInner {...props} />;
}
