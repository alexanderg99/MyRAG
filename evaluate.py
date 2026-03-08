import json
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from query_expander import QueryExpander
from reranker import Reranker

# ── 1. Load your existing pipeline ────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory="./hotpot_chroma_db", embedding_function=embeddings)
llm = Ollama(model="gemma3:12b")
expander = QueryExpander(llm, vectorstore)
reranker = Reranker()

# ── 2. Your RAG function — extracted from rag.py ──────────────────────────
def run_rag(question):
    # Stage 1: broad retrieval
    docs = expander.retrieve(question, k=10, top_n=20)

    # Stage 2: rerank
    docs = reranker.rerank(question, docs, top_k=5)

    contexts = [doc.page_content for doc in docs]
    context = "\n\n".join(contexts)

    prompt = f"""Use the following context to answer the question as fully as possible.
Only say "I don't have information about this in my knowledge base" if the context 
contains absolutely nothing related to the question.

Context:
{context}

Question: {question}

Answer:"""

    answer = llm.invoke(prompt)
    return answer, contexts

# ── 3. Simple scoring function ─────────────────────────────────────────────
def score_answer(question, rag_answer, expected_answer, llm):
    """Use your LLM as a judge to score the answer 1-5"""
    judge_prompt = f"""You are an impartial evaluator. Score the RAG answer against 
the expected answer on these criteria:

1. Faithfulness (1-5): Is the answer factually consistent with the expected answer?
2. Completeness (1-5): Does it cover all key points from the expected answer?
3. Relevance (1-5): Does it actually answer the question asked?

Question: {question}
Expected Answer: {expected_answer}
RAG Answer: {rag_answer}

Respond in this exact format:
Faithfulness: X
Completeness: X  
Relevance: X
Reasoning: [one sentence]"""

    response = llm.invoke(judge_prompt)
    
    # Parse scores
    scores = {"faithfulness": 0, "completeness": 0, "relevance": 0, "reasoning": ""}
    for line in response.strip().split("\n"):
        if line.startswith("Faithfulness:"):
            try:
                scores["faithfulness"] = int(line.split(":")[1].strip()[0])
            except:
                pass
        elif line.startswith("Completeness:"):
            try:
                scores["completeness"] = int(line.split(":")[1].strip()[0])
            except:
                pass
        elif line.startswith("Relevance:"):
            try:
                scores["relevance"] = int(line.split(":")[1].strip()[0])
            except:
                pass
        elif line.startswith("Reasoning:"):
            scores["reasoning"] = line.split(":", 1)[1].strip()
    
    return scores

# ── 4. Run evaluation ──────────────────────────────────────────────────────
with open("eval_dataset.json", "r") as f:
    eval_samples = json.load(f)

# Start with just 10 to test — full 50 takes a while
eval_samples = eval_samples[:10]

print(f"Evaluating {len(eval_samples)} questions...\n")

results = []
for i, sample in enumerate(eval_samples):
    print(f"[{i+1}/{len(eval_samples)}] {sample['question'][:70]}...")

    # Run your RAG
    rag_answer, contexts = run_rag(sample["question"])

    # Score it
    scores = score_answer(
        sample["question"],
        rag_answer,
        sample["expected_answer"],
        llm
    )

    results.append({
        "question": sample["question"],
        "expected_answer": sample["expected_answer"],
        "rag_answer": rag_answer,
        "contexts_used": contexts,
        "num_contexts": len(contexts),
        **scores  # faithfulness, completeness, relevance, reasoning
    })

    print(f"  Faithfulness: {scores['faithfulness']}/5 | "
          f"Completeness: {scores['completeness']}/5 | "
          f"Relevance: {scores['relevance']}/5")
    print(f"  Reasoning: {scores['reasoning']}\n")

# ── 5. Summary stats ───────────────────────────────────────────────────────
print("\n── SUMMARY ─────────────────────────────────────────")
avg_faith = sum(r["faithfulness"] for r in results) / len(results)
avg_comp  = sum(r["completeness"] for r in results) / len(results)
avg_rel   = sum(r["relevance"] for r in results) / len(results)
avg_overall = (avg_faith + avg_comp + avg_rel) / 3

print(f"Avg Faithfulness:  {avg_faith:.2f}/5")
print(f"Avg Completeness:  {avg_comp:.2f}/5")
print(f"Avg Relevance:     {avg_rel:.2f}/5")
print(f"Overall Score:     {avg_overall:.2f}/5")

# Count "I don't know" responses
dont_know = sum(1 for r in results 
                if "don't have information" in r["rag_answer"].lower())
print(f"'I don't know' responses: {dont_know}/{len(results)}")

# ── 6. Save detailed results ───────────────────────────────────────────────
with open("eval_results.json", "w") as f:
    json.dump(results, f, indent=2)

print(f"\nDetailed results saved to eval_results.json")