from datasets import load_dataset
import json

ds = load_dataset("rungalileo/ragbench", "hotpotqa", split="test[:50]")

eval_samples = []
for row in ds:
    # 'documents' is a list of passage strings
    # 'response' is the ground truth answer
    eval_samples.append({
        "question": row["question"],
        "expected_answer": row["response"],
        "contexts": row["documents"],  # list of strings, ready for RAGAs
    })

with open("eval_dataset.json", "w") as f:
    json.dump(eval_samples, f, indent=2)

print(f"Saved {len(eval_samples)} samples")
print(f"\nQuestion: {eval_samples[0]['question']}")
print(f"Answer:   {eval_samples[0]['expected_answer']}")
print(f"Contexts: {len(eval_samples[0]['contexts'])} documents")