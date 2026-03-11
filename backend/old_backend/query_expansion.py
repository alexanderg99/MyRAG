from langchain_core.prompts import PromptTemplate

multi_query_prompt = PromptTemplate.from_template("""
You are an AI search query optimizer. 
Generate 3 different search queries to retrieve relevant documents 
for answering the following question. Make each query target a 
different aspect of the question.
Return ONLY the 3 queries as a numbered list. Nothing else.

Original question: {question}
""")


def generate_queries(question, llm):
    response = llm.invoke(multi_query_prompt.format(question=question))
    lines = [l.strip().lstrip("0123456789. ") 
             for l in response.strip().split("\n") 
             if l.strip()]
    return [question] + lines[:3]  # include original + 3 new ones

def multi_query_retrieve(question, vectorstore, llm, k=8):
    queries = generate_queries(question, llm)
    print(f"\nExpanded queries:")
    for i, q in enumerate(queries):
        print(f"  {i+1}. {q}")
    
    all_docs = []
    seen = set()
    for q in queries:
        docs = vectorstore.similarity_search(q, k=k)
        for doc in docs:
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                all_docs.append(doc)
    
    print(f"Retrieved {len(all_docs)} unique chunks across all queries")
    return all_docs





"------"

#we are working on the query and retrieval segment. 

def reciprocal_rank_fusion(results_lists, k=60):
    """
    results_lists: list of lists of documents, one per query
    k: RRF constant (60 is standard from literature)
    """
    scores = {}
    doc_map = {}
    
    for results in results_lists:
        for rank, doc in enumerate(results):
            key = doc.page_content
            if key not in scores:
                scores[key] = 0
                doc_map[key] = doc
            # RRF formula: 1 / (rank + k)
            scores[key] += 1.0 / (rank + 1 + k)
    
    # Sort by score descending
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [doc_map[key] for key, _ in ranked]

def rag_fusion_retrieve(question, vectorstore, llm, k=10, top_n=5):
    queries = generate_queries(question, llm)
    
    # Search with each query separately
    all_results = []
    for q in queries:
        results = vectorstore.similarity_search(q, k=k)
        all_results.append(results)
    
    # Fuse with RRF
    fused = reciprocal_rank_fusion(all_results)
    return fused[:top_n]  # return top N after fusion



"--------"

hypo_prompt = PromptTemplate.from_template("""
Write a short hypothetical Wikipedia-style paragraph that would 
directly answer the following question. Be factual and concise.
Write as if you are certain of the answer, even if you are not.

Question: {question}

Hypothetical answer:
""")

def hypothetical_retrieve(question, vectorstore, llm, k=8):
    # Generate a hypothetical answer
    hypo_answer = llm.invoke(hypo_prompt.format(question=question))
    
    # Search using the hypothetical answer as the query
    # (it uses similar vocabulary to real documents)
    docs_from_hypo = vectorstore.similarity_search(hypo_answer, k=k)
    docs_from_original = vectorstore.similarity_search(question, k=k)
    
    # Combine and deduplicate
    seen = set()
    combined = []
    for doc in docs_from_hypo + docs_from_original:
        if doc.page_content not in seen:
            seen.add(doc.page_content)
            combined.append(doc)
    
    return combined[:k]



def ask(question, vectorstore, llm, qa_chain, technique="rag_fusion"):
    
    if technique == "simple":
        docs = multi_query_retrieve(question, vectorstore, llm)
    elif technique == "rag_fusion":
        docs = rag_fusion_retrieve(question, vectorstore, llm)
    elif technique == "hyde":
        docs = hypothetical_retrieve(question, vectorstore, llm)
    else:
        docs = vectorstore.similarity_search(question, k=15)
    
    # Format context from retrieved docs
    context = "\n\n".join([doc.page_content for doc in docs])
    
    # Build prompt manually for more control
    prompt = f"""Use the following context to answer the question. 
If the answer is not in the context, say "I don't have information about this."

Context:
{context}

Question: {question}

Answer:"""
    
    return llm.invoke(prompt)


    
    