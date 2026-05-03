"""In-process HTTP layer for the C2 sim.

FastAPI entrypoints in `app.py` sit on a process-wide `TheaterStore`. Client
submitted batches run through `superman.sim.orders.OrderBatch.execute`, then
the store replays the same JSON snapshot shape the offline exporter emits.
"""
