import { getCacheFilepath } from "@lib/cache";
import { apex } from "@lib/common";
import { getErrorMessage } from "@lib/utils";
import fs from "fs/promises";
import { useEffect, useState } from "react";
import { getCameraRefreshInterval } from "./grid";
import { fileToBase64Image } from "./utils";

export function useImage(
  entityID: string,
  defaultIcon?: string,
): {
  localFilepath?: string;
  error?: string;
  isLoading: boolean;
  imageFilepath?: string;
} {
  const [localFilepath, setLocalFilepath] = useState<string | undefined>(defaultIcon);
  const [imageFilepath, setImageFilepath] = useState<string | undefined>(defaultIcon);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let didUnmount = false;
    let previousFilepath: string | undefined;

    async function fetchData() {
      if (didUnmount) {
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        // Each refresh gets its own filename: reusing the same path means the
        // path string never changes, so React skips the re-render and Raycast's
        // markdown renderer treats it as the same cached image.
        const newFilepath = await getCacheFilepath(`img_${entityID}_${Date.now()}.png`, true);
        await apex.getCameraProxyURL(entityID, newFilepath);
        const base64Img = await fileToBase64Image(newFilepath);
        if (!didUnmount) {
          const interval = getCameraRefreshInterval();
          if (interval && interval > 0) {
            setTimeout(fetchData, interval);
          }
          setLocalFilepath(base64Img);
          setImageFilepath(newFilepath);
          if (previousFilepath) {
            await fs.unlink(previousFilepath).catch(() => undefined);
          }
          previousFilepath = newFilepath;
        }
      } catch (error) {
        if (!didUnmount) {
          setError(getErrorMessage(error));
        }
      } finally {
        if (!didUnmount) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      didUnmount = true;
      if (previousFilepath) {
        fs.unlink(previousFilepath).catch(() => undefined);
      }
    };
  }, [entityID]);

  return { localFilepath, error, isLoading, imageFilepath };
}
