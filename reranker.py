from sentence_transformers import CrossEncoder

class Reranker:
    def __init__(self, model_name="cross-encoder/ms-marco-MiniLM-L-6-v2"):
        print("Loading reranker model...")
        self.model = CrossEncoder(model_name)
        print("Reranker ready.")

    def rerank(self, question, docs, top_k=5):
        if not docs:
            return docs

        # Pair the question with every retrieved chunk
        pairs = [[question, doc.page_content] for doc in docs]

        # Score all pairs — this is where cross-encoding happens
        scores = self.model.predict(pairs)

        # Zip scores with docs and sort by score descending
        scored_docs = sorted(
            zip(scores, docs),
            key=lambda x: x[0],
            reverse=True
        )

        # Debug — show scores so you can see what's happening
        print("\nReranking scores:")
        for score, doc in scored_docs[:top_k]:
            title = doc.metadata.get("title", "Unknown")
            print(f"  {score:.4f} | {title}")

        # Return only the top_k docs after reranking
        return [doc for _, doc in scored_docs[:top_k]]