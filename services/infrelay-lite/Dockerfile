FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HF_HOME=/cache/hf

COPY pyproject.toml ./
COPY infrelay_lite ./infrelay_lite
RUN pip install --no-cache-dir .
RUN mkdir -p /cache/hf

EXPOSE 8090
CMD ["uvicorn", "infrelay_lite.app:app", "--host", "0.0.0.0", "--port", "8090"]
