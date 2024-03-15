import os
import sys
import logging
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    StorageContext,
    Settings,
    KeywordTableIndex,
    load_index_from_storage,
    
)
from llama_index.core.embeddings import resolve_embed_model
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.llms.groq import Groq
from llama_index.core.llms import ChatMessage
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
import chromadb


def create_vector_database(persist_dir):
    Groq.api_key = os.getenv('GROQ_API_KEY')
    lms = Groq(model="mixtral-8x7b-32768")
    documents = SimpleDirectoryReader("./data").load_data()
    db = chromadb.PersistentClient(path="./chroma_db")
    chroma_collection = db.get_or_create_collection("niles")
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
    text_splitter = SentenceSplitter(chunk_size=512, chunk_overlap=10)
    Settings.text_splitter = text_splitter
    index = VectorStoreIndex.from_documents(documents, transformations=[text_splitter])
    index.storage_context.persist(persist_dir=persist_dir)
    return index



def query_endpoint(persist_dir):
    storage_context = StorageContext.from_defaults(persist_dir=persist_dir)
    index = load_index_from_storage(storage_context)
    query_engine = index.as_query_engine()
    with open('data/systemPrompt.txt', 'r') as file:
        system_prompt = file.read()
    messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content="explain the healthy mind platter including an accessible example of how i might implement each dish on the platter while at work leading teams"),
    ]
    response = query_engine.query(messages)
    print(response)

def main():
    persist_dir = "<persist_dir>"
    if not os.path.exists(persist_dir):
        index = create_vector_database(persist_dir)
    else:
        storage_context = StorageContext.from_defaults(persist_dir=persist_dir)
        index = load_index_from_storage(storage_context)
    query_endpoint(persist_dir)
if __name__ == "__main__":
    main()