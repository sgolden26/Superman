"""Live HTTP service for the wargame.

`app.py` mounts FastAPI routes against a `TheaterStore` singleton. The store
holds the current theatre in memory; orders submitted by the FE go through
`axis.sim.orders.OrderBatch.execute` and rebuild a snapshot in the same shape
the static exporter writes.
"""
