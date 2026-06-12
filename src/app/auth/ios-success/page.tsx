"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Icon, VStack } from "@seed-design/react";
import { ResultSection } from "@/ui/result-section";
import {
  IconCheckmarkCircleFill,
  IconExclamationmarkCircleFill,
} from "@karrotmarket/react-monochrome-icon";

function IosSuccessPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [showManualButton, setShowManualButton] = useState(false);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- setting state based on URL param on mount; no cascading risk
      setShowManualButton(true);
      return;
    }
    window.close();
    window.location.replace("/");
    const timer = setTimeout(() => setShowManualButton(true), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  function handleClose() {
    window.close();
    if (!error) window.location.replace("/");
  }

  return (
    <VStack
      minHeight="100dvh"
      style={{ backgroundColor: "var(--seed-color-bg-layer-default)" }}
    >
      {error ? (
        <ResultSection
          size="large"
          asset={
            <Box pb="x4">
              <Icon svg={<IconExclamationmarkCircleFill />} size="x10" color="fg.critical" />
            </Box>
          }
          title="로그인에 실패했어요."
          description="돌아가서 다시 시도해요."
          primaryActionProps={{
            children: "창 닫기",
            onClick: handleClose,
          }}
        />
      ) : (
        <ResultSection
          size="large"
          asset={
            <Box pb="x4">
              <Icon svg={<IconCheckmarkCircleFill />} size="x10" color="fg.positive" />
            </Box>
          }
          title="로그인했어요."
          description={
            showManualButton
              ? "창이 자동으로 닫히지 않으면 아래 버튼을 눌러요."
              : "앱으로 돌아가고 있어요..."
          }
          primaryActionProps={
            showManualButton
              ? { children: "앱으로 돌아가기", onClick: handleClose }
              : undefined
          }
        />
      )}
    </VStack>
  );
}

export default function IosSuccessPage() {
  return (
    <Suspense>
      <IosSuccessPageContent />
    </Suspense>
  );
}
