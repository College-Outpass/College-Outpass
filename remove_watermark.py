"""
PDF Image-Based Watermark Removal Script
Detects and removes watermark text regions (like "@nehamamsarmy") from rendered PDF pages.
Uses OCR to identify watermark text locations, then removes only those regions.
Preserves all other content including images and text.
"""

import fitz  # PyMuPDF
import sys
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io
import cv2

try:
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("Warning: pytesseract not installed. Install it for watermark detection:")
    print("  pip install pytesseract")
    print("  Also install Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki")


def detect_watermark_regions_with_ocr(img_array, watermark_texts):
    """
    Use OCR to detect regions containing watermark text and create a mask.
    
    Args:
        img_array (numpy.ndarray): Image as numpy array (BGR format)
        watermark_texts (list): List of watermark text patterns to detect
    
    Returns:
        numpy.ndarray: Binary mask where 255 indicates watermark regions
    """
    if not OCR_AVAILABLE:
        raise ValueError("pytesseract is required for watermark detection. Please install it.")
    
    # Convert BGR to RGB for PIL
    img_rgb = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb)
    
    # Perform OCR with bounding box information
    try:
        # Get OCR data with bounding boxes
        ocr_data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT, config='--psm 6')
        
        # Create a mask for watermark regions
        height, width = img_array.shape[:2]
        mask = np.zeros((height, width), dtype=np.uint8)
        
        # Process each detected text element
        n_boxes = len(ocr_data['text'])
        watermark_found = False
        
        for i in range(n_boxes):
            text = ocr_data['text'][i].strip().lower()
            conf = int(ocr_data['conf'][i])
            
            # Skip empty text or low confidence
            if not text or conf < 30:
                continue
            
            # Check if text contains any watermark pattern
            for watermark in watermark_texts:
                if watermark.lower() in text:
                    watermark_found = True
                    # Get bounding box coordinates
                    x = ocr_data['left'][i]
                    y = ocr_data['top'][i]
                    w = ocr_data['width'][i]
                    h = ocr_data['height'][i]
                    
                    # Add padding around text region
                    padding = 5
                    x_start = max(0, x - padding)
                    y_start = max(0, y - padding)
                    x_end = min(width, x + w + padding)
                    y_end = min(height, y + h + padding)
                    
                    # Mark this region in the mask
                    mask[y_start:y_end, x_start:x_end] = 255
        
        if watermark_found:
            # Dilate mask to cover full watermark area (watermarks can be slightly off)
            kernel = np.ones((5, 5), np.uint8)
            mask = cv2.dilate(mask, kernel, iterations=2)
        
        return mask, watermark_found
        
    except Exception as e:
        print(f"    OCR error: {e}")
        return np.zeros((img_array.shape[0], img_array.shape[1]), dtype=np.uint8), False


def detect_watermark_regions_advanced(img_array, watermark_texts):
    """
    Advanced watermark detection using multiple techniques.
    
    Args:
        img_array (numpy.ndarray): Image as numpy array (BGR format)
        watermark_texts (list): List of watermark text patterns
    
    Returns:
        numpy.ndarray: Binary mask for watermark regions
    """
    height, width = img_array.shape[:2]
    final_mask = np.zeros((height, width), dtype=np.uint8)
    
    if OCR_AVAILABLE:
        # Method 1: OCR-based detection
        ocr_mask, found = detect_watermark_regions_with_ocr(img_array, watermark_texts)
        if found:
            final_mask = cv2.bitwise_or(final_mask, ocr_mask)
    
    # Method 2: Visual detection of repeated patterns (watermarks are often repeated)
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
    
    # Detect light regions (watermarks are often light/semi-transparent)
    _, light_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
    
    # Detect regions with low saturation (watermarks are often grayscale)
    hsv = cv2.cvtColor(img_array, cv2.COLOR_BGR2HSV)
    _, sat_mask = cv2.threshold(hsv[:, :, 1], 30, 255, cv2.THRESH_BINARY_INV)
    
    # Combine visual masks
    visual_mask = cv2.bitwise_and(light_mask, sat_mask)
    
    # Clean up visual mask (remove noise)
    kernel = np.ones((3, 3), np.uint8)
    visual_mask = cv2.morphologyEx(visual_mask, cv2.MORPH_OPEN, kernel)
    visual_mask = cv2.morphologyEx(visual_mask, cv2.MORPH_CLOSE, kernel)
    
    # Only include visual detection if we found text regions with OCR
    # This helps reduce false positives
    if OCR_AVAILABLE and np.any(final_mask > 0):
        # Expand OCR mask region slightly to include surrounding watermark areas
        expanded_mask = cv2.dilate(final_mask, np.ones((10, 10), np.uint8), iterations=2)
        # Use visual mask only in regions near detected text
        visual_mask = cv2.bitwise_and(visual_mask, expanded_mask)
        final_mask = cv2.bitwise_or(final_mask, visual_mask)
    elif not OCR_AVAILABLE:
        # If no OCR, use visual detection but be conservative
        final_mask = visual_mask
    
    return final_mask


def remove_watermark_from_page_image(img_array, watermark_texts):
    """
    Remove watermark regions from a page image while preserving all other content.
    
    Args:
        img_array (numpy.ndarray): Page image as numpy array (BGR format)
        watermark_texts (list): List of watermark text patterns to remove
    
    Returns:
        numpy.ndarray: Cleaned image
    """
    # Detect watermark regions
    try:
        mask = detect_watermark_regions_advanced(img_array, watermark_texts)
        
        # Check if we found any watermark regions
        if not np.any(mask > 0):
            # No watermark detected, return original
            return img_array
        
        # Use inpainting to remove watermark regions
        # INPAINT_NS (Navier-Stokes) gives better results for text removal
        cleaned = cv2.inpaint(img_array, mask, 5, cv2.INPAINT_NS)
        
        return cleaned
        
    except Exception as e:
        print(f"    Error in watermark removal: {e}")
        # Return original if processing fails
        return img_array


def process_page_to_remove_watermark(page, watermark_texts, zoom=2.0):
    """
    Process a PDF page to remove watermark regions while preserving all content.
    
    Args:
        page: PyMuPDF page object
        watermark_texts (list): List of watermark text patterns
        zoom (float): Zoom factor for rendering quality
    
    Returns:
        PIL.Image: Processed page image
    """
    # Render page as high-resolution image
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    # Convert to PIL Image
    img_data = pix.tobytes("ppm")
    pil_img = Image.open(io.BytesIO(img_data))
    
    # Convert to numpy array (RGB)
    img_array = np.array(pil_img)
    
    # Convert RGB to BGR for OpenCV
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    # Remove watermark regions
    cleaned_bgr = remove_watermark_from_page_image(img_bgr, watermark_texts)
    
    # Convert back to RGB
    cleaned_rgb = cv2.cvtColor(cleaned_bgr, cv2.COLOR_BGR2RGB)
    
    # Convert back to PIL Image
    cleaned_pil = Image.fromarray(cleaned_rgb)
    
    return cleaned_pil


def remove_watermark_from_pdf(input_pdf_path, output_pdf_path=None, watermark_texts=None, zoom=2.0):
    """
    Remove watermark text regions from PDF while preserving all other content.
    
    Args:
        input_pdf_path (str): Path to input PDF file
        output_pdf_path (str): Path to save cleaned PDF (optional)
        watermark_texts (list): List of watermark text patterns to remove
        zoom (float): Zoom factor for rendering quality (higher = better quality, slower)
    
    Returns:
        str: Path to the cleaned PDF file
    """
    if not os.path.exists(input_pdf_path):
        raise FileNotFoundError(f"PDF file not found: {input_pdf_path}")
    
    if not OCR_AVAILABLE:
        raise ImportError(
            "pytesseract is required for this script. Please install:\n"
            "  1. pip install pytesseract\n"
            "  2. Install Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki"
        )
    
    # Generate output path if not provided
    if output_pdf_path is None:
        input_path = Path(input_pdf_path)
        output_pdf_path = str(input_path.parent / f"{input_path.stem}_no_watermark{input_path.suffix}")
    
    # Default watermark texts
    if watermark_texts is None:
        watermark_texts = ["@nehamamsarmy", "nehamamsarmy", "hamamsarmy", "ALLEN"]
    
    print(f"Opening PDF: {input_pdf_path}")
    print(f"Looking for watermark text: {watermark_texts}")
    print(f"Zoom factor: {zoom}x (higher = better quality)")
    
    # Open the PDF
    doc = fitz.open(input_pdf_path)
    total_pages = len(doc)
    
    # Create new PDF for output
    output_doc = fitz.open()
    
    print(f"\nProcessing {total_pages} pages...")
    
    pages_processed = 0
    
    # Process each page
    for page_num in range(total_pages):
        page = doc[page_num]
        print(f"Page {page_num + 1}/{total_pages}...", end=" ")
        
        try:
            # Process page to remove watermark
            cleaned_img = process_page_to_remove_watermark(page, watermark_texts, zoom=zoom)
            
            # Convert PIL Image to bytes
            img_bytes = io.BytesIO()
            cleaned_img.save(img_bytes, format='PNG', quality=100)
            img_bytes.seek(0)
            
            # Create new page with same dimensions
            rect = page.rect
            new_page = output_doc.new_page(width=rect.width, height=rect.height)
            
            # Insert cleaned image
            new_page.insert_image(rect, stream=img_bytes, keep_proportion=True)
            
            pages_processed += 1
            print("✓")
            
        except Exception as e:
            print(f"✗ Error: {e}")
            # If processing fails, copy original page
            output_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
    
    print(f"\nProcessed {pages_processed}/{total_pages} pages successfully")
    print(f"Saving cleaned PDF to: {output_pdf_path}")
    
    # Save the cleaned PDF
    output_doc.save(output_pdf_path, 
                    garbage=4,      # Aggressive garbage collection
                    deflate=True,   # Compress
                    clean=True,     # Clean up
                    ascii=False)    # Binary format for quality
    
    doc.close()
    output_doc.close()
    
    print(f"✓ Successfully created cleaned PDF!")
    return output_pdf_path


def main():
    """Main function to run the watermark removal."""
    # PDF path
    pdf_path = r"C:\Users\Administrator\Desktop\Water Mark\JEE Mains Top 100 PYQs Last 7 Years_260110_145539.pdf"
    
    # Watermark texts to detect and remove
    watermark_texts = [
        "@nehamamsarmy",
        "nehamamsarmy",
        "hamamsarmy",
        "ALLEN",
        # Add more watermark text patterns here if needed
    ]
    
    try:
        # Process PDF
        # zoom: 2.0 = good balance, increase to 3.0 for better quality (slower)
        output_path = remove_watermark_from_pdf(
            input_pdf_path=pdf_path,
            watermark_texts=watermark_texts,
            zoom=2.0  # Increase to 3.0 or 4.0 for higher quality
        )
        
        print(f"\n✓ Done! Cleaned PDF saved at:")
        print(f"  {output_path}")
        
        print("\nThe script uses OCR to detect watermark text regions and removes only those areas.")
        print("All other content (text, images, diagrams) is preserved.")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
