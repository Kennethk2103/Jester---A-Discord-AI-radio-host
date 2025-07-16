from diffusers import DiffusionPipeline
import torch
import sys
import os



pipe = DiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, use_safetensors=True, variant="fp16")
pipe.enable_model_cpu_offload()



# if using torch < 2.0
# pipe.enable_xformers_memory_efficient_attention()

##get arg
prompt = sys.argv[1]
print(f"Prompt: {prompt}")

images = pipe(prompt).images[0]

images.save("./output.png")
