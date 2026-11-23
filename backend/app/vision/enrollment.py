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
    value: str,
):

    values = json.loads(value)

    array = np.asarray(
        values,
        dtype=np.float32,
    )

    return array.reshape(
        1,
        -1,
    )