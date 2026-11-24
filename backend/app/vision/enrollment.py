import json

import numpy as np


def embedding_to_json(
    embedding,
) -> str:

    array = np.asarray(
        embedding,
        dtype=np.float32,
    )

    return json.dumps(
        array.flatten().tolist()
    )


def embedding_from_json(
    value: str | bytes,
):
    if isinstance(value, bytes):
        try:
            stripped = value.strip()
            if not (stripped.startswith(b"[") and stripped.endswith(b"]")):
                return np.frombuffer(value, dtype=np.float32).reshape(1, -1)
            values = json.loads(stripped.decode("utf-8"))
            return np.asarray(values, dtype=np.float32).reshape(1, -1)
        except Exception:
            return np.frombuffer(value, dtype=np.float32).reshape(1, -1)

    if isinstance(value, str):
        values = json.loads(value)
        array = np.asarray(
            values,
            dtype=np.float32,
        )
        return array.reshape(
            1,
            -1,
        )

    return np.asarray(value, dtype=np.float32).reshape(1, -1)