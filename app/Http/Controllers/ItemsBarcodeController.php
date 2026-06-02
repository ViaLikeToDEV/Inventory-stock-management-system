<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ItemsBarcodeController extends Controller
{
    /**
     * Generate a random EAN-13 barcode.
     */
    public function generate(): JsonResponse
    {
        $ean = $this->generateEAN13();

        return response()->json([
            'ean13'     => $ean,
            'valid'     => $this->validateEAN13($ean),
        ]);
    }

    /**
     * Generate multiple EAN-13 barcodes.
     */
    public function generateBatch(int $count = 10): JsonResponse
    {
        $count = min(max($count, 1), 100); // clamp 1–100

        $barcodes = array_map(
            fn() => $this->generateEAN13(),
            array_fill(0, $count, null)
        );

        return response()->json([
            'count'    => $count,
            'barcodes' => $barcodes,
        ]);
    }

    // ──────────────────────────────────────────
    // Core Logic
    // ──────────────────────────────────────────

    private function generateEAN13(): string
    {
        // Generate 12 random digits
        $digits = [];
        for ($i = 0; $i < 12; $i++) {
            $digits[] = random_int(0, 9);
        }

        // Append check digit
        $digits[] = $this->calculateCheckDigit($digits);

        return implode('', $digits);
    }

    private function calculateCheckDigit(array $digits): int
    {
        // EAN-13: odd positions × 1, even positions × 3
        $sum = 0;
        foreach ($digits as $index => $digit) {
            $weight = ($index % 2 === 0) ? 1 : 3;
            $sum += $digit * $weight;
        }

        return (10 - ($sum % 10)) % 10;
    }

    private function validateEAN13(string $barcode): bool
    {
        if (!preg_match('/^\d{13}$/', $barcode)) {
            return false;
        }

        $digits = array_map('intval', str_split($barcode));
        $checkDigit = array_pop($digits);

        return $this->calculateCheckDigit($digits) === $checkDigit;
    }
}
