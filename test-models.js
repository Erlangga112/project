const fs = require('fs');

async function testModels() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.log("No API Key");
    return;
  }

  const models = [
    "meta/llama-3.2-11b-vision-instruct",
    "meta/llama-3.2-90b-vision-instruct",
    "mistralai/mistral-large-2-instruct",
    "mistralai/mixtral-8x22b-v0.1",
    "google/gemma-3-12b-it",
    "meta/llama2-70b"
  ];

  for (const model of models) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 10
        })
      });
      if (res.ok) {
        console.log(`[SUCCESS] ${model} works!`);
        break; // Stop when we find one that works
      } else {
        const text = await res.text();
        console.log(`[FAIL] ${model}: ${res.status} ${text}`);
      }
    } catch (e) {
      console.log(`[ERROR] ${model}: ${e.message}`);
    }
  }
}

testModels();
