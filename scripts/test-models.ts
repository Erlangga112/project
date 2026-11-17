import "dotenv/config";

async function testModels() {
  const models = [
    "meta/llama-3.3-70b-instruct",
    "meta/llama-3.1-8b-instruct",
    "meta/llama-3.1-70b-instruct",
    "mistralai/mistral-7b-instruct-v0.3",
  ];

  for (const model of models) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
        }),
      });
      console.log(`Model ${model}: Status ${res.status}`);
      if (res.ok) {
        const d = await res.json();
        console.log(` -> Content: ${d.choices?.[0]?.message?.content}`);
        break;
      } else {
        const err = await res.text();
        console.log(` -> Error: ${err.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`Model ${model} fetch failed: ${e.message}`);
    }
  }
}

testModels().finally(() => process.exit(0));

