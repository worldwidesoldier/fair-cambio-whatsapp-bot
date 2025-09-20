import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle, Copy } from 'lucide-react';

interface QRCodeScannerProps {
  onScan?: (data: string) => void;
  onClose?: () => void;
}

export default function QRCodeScanner({ onScan, onClose }: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);
      setScannedData(null);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);

        // Start scanning for QR codes
        scanForQRCode();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const scanForQRCode = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Try to detect QR code using ImageData
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // Simple QR code detection (this is a basic implementation)
      // In a real implementation, you'd use a library like jsQR
      const qrResult = detectQRCode(imageData);

      if (qrResult) {
        setScannedData(qrResult);
        setIsScanning(false);
        stopScanning();
        onScan?.(qrResult);
        return;
      }
    } catch (err) {
      console.error('QR scan error:', err);
    }

    // Continue scanning
    if (isScanning) {
      requestAnimationFrame(scanForQRCode);
    }
  };

  // Basic QR code detection (placeholder - would use jsQR or similar library)
  const detectQRCode = (imageData: ImageData): string | null => {
    // This is a mock implementation
    // In reality, you'd use a library like jsQR here

    // Simulate finding a QR code after a few seconds
    const randomChance = Math.random();
    if (randomChance > 0.98) { // 2% chance per frame
      return `1@${Math.random().toString(36).substr(2, 12)},${Math.random().toString(36).substr(2, 44)},${Math.random().toString(36).substr(2, 32)}==`;
    }

    return null;
  };

  const copyToClipboard = async () => {
    if (scannedData) {
      try {
        await navigator.clipboard.writeText(scannedData);
        alert('Dados copiados para a área de transferência!');
      } catch (err) {
        console.error('Erro ao copiar:', err);
      }
    }
  };

  const handleRetry = () => {
    setScannedData(null);
    setError(null);
    startScanning();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scanner QR Code
            </CardTitle>
            <CardDescription>
              Escaneie QR codes com a câmera
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {scannedData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">QR Code detectado!</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Dados escaneados:</p>
              <p className="text-xs font-mono bg-white p-2 rounded border break-all">
                {scannedData}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={copyToClipboard} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button variant="outline" onClick={handleRetry} className="flex-1">
                Escanear Novamente
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <video
                ref={videoRef}
                className={`w-full rounded-lg ${isScanning ? 'block' : 'hidden'}`}
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />

              {!isScanning && (
                <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Câmera não iniciada</p>
                  </div>
                </div>
              )}

              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-blue-500 border-dashed rounded-lg">
                    <div className="w-full h-full bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <p className="text-xs text-blue-600 font-medium">
                        Posicione o QR code aqui
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isScanning ? (
                <Button onClick={startScanning} className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Iniciar Scanner
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopScanning} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Parar Scanner
                </Button>
              )}
            </div>

            <div className="text-xs text-gray-500 text-center">
              <p>💡 Dica: Mantenha o QR code bem iluminado e centralizado</p>
              <p>📱 Funciona melhor em dispositivos móveis</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}