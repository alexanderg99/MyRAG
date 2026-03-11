from langchain_core.prompts import PromptTemplate
from langchain_community.llms import ollama
from langchain_community.vectorstores import Chroma

class QueryExpander:
    def __init__(self,llm,vectorstore):
        self.llm = llm
        self.vectorstore = vectorstore
        self.prompt = PromptTemplate.from_template("""
You are a search query optimizer for a semantic vector search engine.
Generate 3 natural language search queries to find relevant documents 
for answering the question below.

Rules:
- Write each query as a plain natural language sentence or phrase
- No boolean operators (AND, OR, NOT)
- No quotes around terms
- Each query should target a different aspect of the question
- Return ONLY a numbered list of 3 queries, nothing else

Question: {question}
""")

    def generate_queries(self,question):
        response = self.llm.invoke(self.prompt.format(question=question))
        lines = [l.strip().lstrip("0123456789. ") 
                    for l in response.strip().split("\n")
                    if l.strip()]
        return [question] + lines[:3]
    
    def reciprocal_rank_fusion(self, results_lists, k=60):
        scores = {}
        doc_map = {}
        for results in results_lists:
            for rank, doc in enumerate(results):
                key = doc.page_content
                if key not in scores:
                    scores[key] = 0
                    doc_map[key] = doc
                scores[key] += 1.0 / (rank + 1 + k)
                
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [doc_map[key] for key, _ in ranked]
    
    def retrieve(self, question, k=10, top_n=5):
        # generating query variations
        queries = self.generate_queries(question)
        print(f"\nExpanded queries:")
        for i, q in enumerate(queries):
            print(f" {i+1}. {q}")
            
        all_results = []
        for q in queries:
            results = self.vectorstore.similarity_search(q, k=k)
            all_results.append(results)
            
        fused = self.reciprocal_rank_fusion(all_results)
        return fused[:top_n]