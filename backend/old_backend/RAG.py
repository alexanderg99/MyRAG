from datasets import load_dataset
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain_classic.chains.retrieval_qa.base import RetrievalQA
from langchain_experimental.text_splitter import SemanticChunker

import os
from query_expander import QueryExpander
from reranker import Reranker
import json

# 1. Load 1000 Wikipedia articles
# Load from disk instantly, no internet needed


CHROMA_PATH = "./chroma_db"
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


if os.path.exists(CHROMA_PATH) and os.listdir(CHROMA_PATH):
    print("Loading existing vectorstore...")
    vectorstore = Chroma(
        persist_directory=CHROMA_PATH,
        embedding_function=embeddings
    )
    
else:
    with open("wiki_1000.json", "r") as f:
        docs = json.load(f)

    raw_docs = [d["text"] for d in docs]
    metadatas = [{"title": d["title"], "url": d.get("url", "")} for d in docs]



    # 3. Embed + store
    
    
    chunker = SemanticChunker(
        embeddings,
        breakpoint_threshold_type="percentile",  # cuts at top X% of semantic distances
        breakpoint_threshold_amount=95           # only cut at the 95th percentile — fewer, bigger chunks
                                                # lower = more cuts, smaller chunks
    )

    chunks = chunker.create_documents(raw_docs, metadatas=metadatas)
    vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

    print(f"Total chunks: {len(chunks)}")
    print(f"Sample chunk:\n{chunks[0].page_content}")


# 4. RAG chain
llm = Ollama(model="gemma3:12b")

expander = QueryExpander(llm,vectorstore)
reranker = Reranker()


# 5. Ask questions
while True:
    q = input("\nQuestion (or quit): ")
    if q == "quit": 
        break
    docs = expander.retrieve(q, k=10, top_n=5)
    print("\n--- RAW RETRIEVED CHUNKS ---")
    for i, doc in enumerate(docs[:3]):
        print(f"\nChunk {i+1}:")
        print(doc.page_content[:300])

    
    docs = reranker.rerank(q, docs, top_k=5)
    context = "\n\n".join([doc.page_content for doc in docs])

    # Prompt with guardrail built in
    prompt = f"""Use the following context to answer the question.
If the answer is not contained in the context, say exactly:
"I don't have information about this in my knowledge base."
Do not make up answers.

Context:
{context}

Question: {q}

Answer:"""

    answer = llm.invoke(prompt)
    print(f"\nAnswer: {answer}")

    # Show which sources were used
    print("\nSources:")
    for i, doc in enumerate(docs[:3]):
        title = doc.metadata.get("title", "Unknown")
        print(f"  [{i+1}] {title}: {doc.page_content[:100]}...")
