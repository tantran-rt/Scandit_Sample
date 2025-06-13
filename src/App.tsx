"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as SDCCore from "scandit-web-datacapture-core";
import * as SDCBarcode from "scandit-web-datacapture-barcode";
import "./App.css";
import Webcam from "react-webcam";

const licenseKey =
  "AvUmeW8oRiD5FdlPEyDgCe4V3j5LFKtNRBG0F+DhoPWgfD81s3uyrd9GF2rTee3QtzSJD9ESxZjKWWWzslJml/d7SBY+FEugsEZnwNpVvWenUQgmSGrbbtNkPGiwXeiebW+eBMQyD2a3cKgHuHBpLvBpwZQLdyalkRD+VM4cs8RfEE96Bja2CJgheJ4a6wOS4OaMGa/OiTcCI2djiJbtUufu5zYTjxhNtVSUQqr9GfFCA/y57YLW+d3tqxOFH2IgJT3/9Ek03cAGr/tdXwQ6e0npnEnRmmlOnkYUFE1YdobjM6liFNbZgDYLHBkiumDSwViuT92nV+BcjQgcECpXDJm5qd1CNvVPh0OtBXCIO5F28JlhtGlRMrX0yLKZ0UsQBkwevLaYEMrQ+n4Y8ycdRz2Y/aidTWGXX50q/MvjqDRYLd2pTqe2bvxWgKR78LuwR7hXpuNziR/Mta8mSd7OL7bziRrugXZLFV6/9S5CoE+F7ICJaIgYGpbHio9ij4wP/o5sQodzJty8pUJcIHsCgZRtp+I36IXnR9wA5rlqJ9XvNJFrb+PBp5ybhOrCcYqDbweyuEilXlDkddGGxmLg0BsJfMKhLENZpRjtBCo9MkE8Hci0xGNNStCCcaN7BTLQi0sqB3S+wTeIHBbAxUUQEU2fW0e1QLeQ/YvivaN19e+aDfe7p3MtVMT8GglSSF6bxD/TUsOHzBw5qKomr4obogwxKnivFe6QmoZD2B0GPeC5wDOwMw2ROSun/rg1Td1+OKPvz8NgN1cuKOiUaw1ODzhIBBRC0112oy1c7gZe5NRpNK9Ilsw7e4s11lH4feNCdvjCyj3S3abLsToxrQtKNkFNonaIwKlhkvRCtQ==";

const QRScanner = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const cameraRef = useRef<Webcam | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const barcodeCaptureRef = useRef<SDCBarcode.BarcodeCapture | null>(null);
  const viewRef = useRef<SDCCore.DataCaptureView | null>(null);
  const contextRef = useRef<SDCCore.DataCaptureContext | null>(null);
  const settingsRef = useRef<SDCBarcode.BarcodeCaptureSettings | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(
    null
  );
  const [barcode, setBarcode] = useState<string>("");
  const intervalRef = useRef<number | null>(null);

  // Initialize Scandit components
  useEffect(() => {
    let isActive = true;

    const initializeScandit = async () => {
      try {
        console.log("Initializing Scandit SDK...");

        // Configure the SDK
        await SDCCore.configure({
          licenseKey: licenseKey as string,
          libraryLocation:
            "https://cdn.jsdelivr.net/npm/scandit-web-datacapture-barcode@6.x/build/engine/",
          moduleLoaders: [SDCBarcode.barcodeCaptureLoader()],
        });

        if (!isActive) return;

        // Create context
        if (!contextRef.current) {
          console.log("Creating data capture context...");
          const context = await SDCCore.DataCaptureContext.create();
          if (!isActive) return;
          contextRef.current = context;
        }

        // Configure barcode settings
        if (!settingsRef.current) {
          console.log("Configuring barcode settings...");
          const settings = new SDCBarcode.BarcodeCaptureSettings();

          // Enable QR, MicroQR, and Code128 codes
          settings.enableSymbologies([
            SDCBarcode.Symbology.QR,
            SDCBarcode.Symbology.MicroQR,
            SDCBarcode.Symbology.Code128,
          ]);

          // Set high scanning frequency for better performance
          settings.codeDuplicateFilter = 1000; // 1 second between duplicate scans

          // Enable inverted QR codes (white on black)
          try {
            settings.setProperty("qr-code.color-inverted-enabled", true);
          } catch (error) {
            console.warn("Failed to set property:", error);
          }

          settingsRef.current = settings;
        }

        if (!isActive) return;
        setIsInitialized(true);
      } catch (error) {
        console.error("Error during initialization:", error);
      }
    };

    initializeScandit();
  }, []);

  const listener = useCallback(
    async (
      barcodeCapture: SDCBarcode.BarcodeCapture,
      session: SDCBarcode.BarcodeCaptureSession
    ) => {
      const barcode = session.newlyRecognizedBarcode;

      if (barcode?.data) {
        console.log("Barcode scanned:", barcode?.data);
        setBarcode(barcode?.data);
      }
    },
    []
  );

  const runScanner = useCallback(
    async (imageElement: HTMLImageElement) => {
      if (!contextRef.current || !settingsRef.current) {
        return;
      }

      console.log("Running scanner with image element:");

      try {
        const source = await SDCCore.ImageFrameSource.fromImage(imageElement);
        await contextRef.current.setFrameSource(source);

        const barcodeCapture = await SDCBarcode.BarcodeCapture.forContext(
          contextRef.current,
          settingsRef.current
        );

        barcodeCapture.addListener({
          didScan: listener,
        });
        await source.switchToDesiredState(SDCCore.FrameSourceState.On);
        await barcodeCapture.setEnabled(true);
      } catch (error) {
        console.error("Error running scanner:", error);
      }
    },
    [listener]
  );

  useEffect(() => {
    if (imageElement?.src && !barcode) {
      runScanner(imageElement);
    }
  }, [runScanner, imageElement, barcode]);

  // Capture images at a reasonable rate
  useEffect(() => {
    if (barcode !== "") return;

    const captureImage = () => {
      if (!cameraRef.current || barcode !== "") return;

      try {
        const screenshot = cameraRef.current.getScreenshot();
        if (screenshot) {
          console.log("Captured screenshot:", screenshot);
          const img = new window.Image();
          img.onload = () => {
            setImageElement(img);
          };
          img.src = screenshot;
        }
      } catch (error) {
        console.error("Error capturing image:", error);
      }
    };

    intervalRef.current = window.setInterval(captureImage, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [barcode, cameraRef]);

  return (
    <div className="main-camera-container">
      <h3>QR/ Code-128 Scanner</h3>
      <h3>Scanned Data: {barcode}</h3>
      <Webcam
        ref={cameraRef}
        audio={false}
        className="test-camera-container"
        videoConstraints={{
          facingMode: "user",
          width: 1920,
          height: 1080,
        }}
        imageSmoothing={false}
        style={{
          position: "absolute",
          top: 0,
          width: 1000,
          height: 1000,
        }}
        mirrored
      />
    </div>
  );
};

export default QRScanner;
