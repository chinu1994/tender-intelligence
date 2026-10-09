CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200


def create_chunks(sections: list[dict]) -> list[dict]:
    chunks = []

    for section in sections:
        text = section["text"].strip()

        if not text:
            continue

        start = 0

        while start < len(text):
            end = start + CHUNK_SIZE
            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "text": chunk_text,
                    "page_number": section.get("page_number"),
                    "paragraph_number": section.get("paragraph_number"),
                })

            if end >= len(text):
                break

            start = end - CHUNK_OVERLAP

    return chunks
