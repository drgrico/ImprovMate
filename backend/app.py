import os, sys
import random
import uuid
from flask import Flask, jsonify, request, send_file, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import save_base64_image, logger_setup, get_mimetype
from config import *
from llm import Storyteller

load_dotenv()

# Specify the static folder path
app = Flask(__name__)
CORS(app)


# Get the environment variables
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_ORG_ID = os.environ.get("OPENAI_ORG_ID")

PORT = os.environ.get("FLASK_PORT", 5000)
HOST = os.environ.get("FLASK_HOST", "0.0.0.0")
DEBUG = os.environ.get("FLASK_DEBUG", "False").lower() in ("true", "1", "t")
LOGGER = os.environ.get("LOGGER", "False").lower() in ("true", "1", "t")
STORAGE_PATH = "static"

if LOGGER:
    logger = logger_setup("app", os.path.join(LOG_FOLDER, "app.log"), debug=DEBUG)
else:
    logger = None


# Initialize the storyteller
llm = Storyteller(OPENAI_API_KEY, OPENAI_ORG_ID)


@app.route("/api")
def index():
    # Return a json response representing the API, with the available endpoints
    response = dict(
        {
            "prefix": "/api",
            "endpoints": {
                "image": {
                    "methods": ["POST", "GET"],
                    "description": "Save and retrieve images",
                },
                "character": {
                    "methods": ["POST", "GET"],
                    "description": "Generate and retrieve characters",
                },
                "session": {
                    "methods": ["GET"],
                    "description": "Initialize and retrieve sessions",
                },
                "story/premise": {
                    "methods": ["POST"],
                    "description": "Generate a story premise",
                },
                "story/part": {
                    "methods": ["POST"],
                    "description": "Generate a story part",
                },
                "story": {
                    "methods": ["GET"],
                    "description": "Initialize a story",
                },
                "story/actions": {
                    "methods": ["POST"],
                    "description": "Generate story actions",
                },
                "read": {
                    "methods": ["POST"],
                    "description": "Read text using the API",
                },
            },
        }
    )
    # Sort the endpoints by name
    response["endpoints"] = dict(sorted(response["endpoints"].items()))
    return jsonify(type="success", message="API available", status=200, data=response)


@app.route("/api/image", methods=["POST"])
def image_save():
    os.makedirs(STORAGE_PATH, exist_ok=True)
    # Save the base64 image
    data = request.get_json()

    base64_url = data["image"]
    img_data = base64_url.split(",", 1)[1]
    img_type = data["type"]

    if not base64_url:
        if logger:
            logger.error("No image found in the request!")
            logger.debug(data)
        return jsonify(type="error", message="No image found!", status=400)

    if img_type not in APP_IMAGE_EXT:
        if logger:
            logger.error("Invalid image type!")
            logger.debug(data)
        return jsonify(type="error", message="Invalid image type!", status=400)

    img_fname = f"img_{uuid.uuid4().hex}.{img_type}"
    img_path = os.path.join(STORAGE_PATH, img_fname)
    save_base64_image(img_data, img_path)

    if logger:
        logger.info(f"Image saved: {img_path}")
    return jsonify(type="success", message="Image saved!", status=200, name=img_fname)


@app.route("/api/image/<img_name>", methods=["GET"])
def image_get(img_name):
    # Get the base64 image
    img_path = os.path.join(STORAGE_PATH, img_name)
    img_type = img_name.split(".")[-1]

    if not os.path.exists(img_path):
        if logger:
            logger.error(f"Image not found: {img_path}")
        return jsonify(type="error", message="Image not found!", status=404)

    if logger:
        logger.info(f"Image sent: {img_path}")
    return send_file(img_path, mimetype=f"image/{img_type}")


@app.route("/api/character", methods=["POST"])
def character_gen():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        complexity = data.get("complexity", None)
        context = data.get("context", None)
        image = context["image"]
        if not image:
            if logger:
                logger.error("No image found in the request!")
                logger.debug(data)
            return jsonify(type="error", message="No image found!", status=400)

        result = llm.generate_character(image, complexity)
        return jsonify(
            type="success",
            message="Character generated!",
            status=200,
            data={
                "id": uuid.uuid4(),
                "image": {"src": image, **result["image"]},
                "character": {**result["character"]},
            },
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/character/<char_id>", methods=["GET"])
def character_get(char_id):
    pass


@app.route("/api/session", methods=["GET"])
def session_init():
    try:
        session_id = uuid.uuid4()
        if logger:
            logger.info(f"Session initialized: {session_id}")
        return jsonify(
            type="success",
            message="Session initialized!",
            status=200,
            data={"id": session_id},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/session/<session_id>", methods=["GET"])
def session_get(session_id):
    pass


@app.route("/api/story/premise", methods=["POST"])
def premise_gen():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        complexity = data.get("complexity", None)
        context = data.get("context", None)

        context = {
            "name": context["fullname"],
            "about": context["backstory"],
        }

        result = llm.generate_premise(
            context,
            complexity,
            PREMISE_GEN_COUNT,
        )
        if logger:
            logger.debug(f"Story premise generated: {result}")
        return jsonify(
            type="success",
            message="Story premise generated!",
            status=200,
            data={**result},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/story/part", methods=["POST"])
def storypart_gen():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        complexity = data.get("complexity", None)
        context = data.get("context", None)

        result = llm.generate_story_part(context, complexity)
        part_id = uuid.uuid4()
        if logger:
            logger.debug(f"Story part generated: {result}")
        part = result["part"]
        return jsonify(
            type="success",
            message="Story part generated!",
            status=200,
            data={"id": part_id, **part},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/story/init", methods=["POST"])
def story_init():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        complexity = data.get("complexity", None)
        context = data.get("context", None)

        context = {
            "setting": context["desc"],
            "protagonist": {
                "name": context["fullname"],
                "about": context["backstory"],
            },
        }

        result = llm.initialize_story(context, complexity)
        story_id = uuid.uuid4()
        part_id = uuid.uuid4()
        if logger:
            logger.info(f"Story initialized!")

        return jsonify(
            type="success",
            message="Story initialized!",
            status=200,
            data={"id": story_id, "parts": [{"id": part_id, **result}]},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/story/end", methods=["POST"])
def story_end():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        print(data)
        complexity = data.get("complexity", None)
        context = data.get("context", None)

        result = llm.terminate_story(context, complexity)
        if logger:
            logger.info(f"Story ended!")
        part = result["part"]
        part_id = uuid.uuid4()
        return jsonify(
            type="success",
            message="Story ended!",
            status=200,
            data={"id": part_id, **part},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/story/actions", methods=["POST"])
def actions_gen():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        complexity = data.get("complexity", None)
        context = data.get("context", None)

        result = llm.generate_actions(context, complexity, ACTION_GEN_COUNT)
        actions = result["list"]
        actions = random.sample(actions, ACTION_GEN_COUNT)
        actions.append(
            {
                "title": "Motion Capture",
                "desc": "Use your body to progress the story!",
            }
        )
        actions.append(
            {
                "title": "Ending",
                "desc": "Bring the story to an end and see what happens!",
            }
        )
        actions = [{"id": uuid.uuid4(), **a, "active": True} for a in actions]
        if logger:
            logger.debug(f"Story actions generated: {actions}")
        return jsonify(
            type="success",
            message="Story actions generated!",
            status=200,
            data={"list": actions},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/story/motion", methods=["POST"])
def process_motion(): 
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)
        
        if logger:
            logger.debug(f"Data from request: {data}")
        
        context = data.get("context", None)
        if not context:
            if logger:
                logger.error("No context found in the request!")
            return jsonify(type="error", message="No context found!", status=400)
        
        video_blob = context.get("video", None)
        if not video_blob:
            if logger:
                logger.error(f"Invalid video_blob format! Data: {data}")
            return jsonify(type="error", message="Invalid video_blob format!", status=400)
        
        result = llm.process_motion(video_blob)       
        if logger:
            logger.debug(f"Motion processed: {result}")
        return jsonify(
            type="success",
            message="Motion processed!",
            status=200,
            data={**result},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/story/image", methods=["POST"])
def storyimage_gen():
    try:
        data = request.get_json()
        if not data:
            if logger:
                logger.error("No data found in the request!")
            return jsonify(type="error", message="No data found!", status=400)

        result = llm.generate_story_image(data)
        if logger:
            logger.debug(f"Story image generated: {result}")
        return jsonify(
            type="success",
            message="Story image generated!",
            status=200,
            data={**result},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/translate", methods=["GET"])
def translate_text():
    try:
        text = request.args.get("text")
        src_lang = request.args.get("src_lang")
        tgt_lang = request.args.get("tgt_lang")

        if src_lang == tgt_lang:
            if logger:
                logger.debug("No translation needed!")
            return jsonify(
                type="success",
                message="No translation needed!",
                status=200,
                data={"text": text},
            )

        if logger:
            logger.debug(f"Translating text from {src_lang} to {tgt_lang}")
        result = llm.translate_text(text, src_lang, tgt_lang)
        return jsonify(
            type="success",
            message="Text translated!",
            status=200,
            data={"text": result},
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/read", methods=["GET"])
def read_text():
    try:
        text = request.args.get("text")
        os = request.args.get("os", "undetermined")
        if logger:
            logger.debug(f"Generating speech for: {text}")

        mimetype = get_mimetype(os)
        return Response(
            stream_with_context(llm.send_tts_request(text, os)),
            mimetype=mimetype,
        )
    except Exception as e:
        if logger:
            logger.error(str(e))
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify(type="error", message="Not found!", status=404)


if __name__ == "__main__":
    app.run(host=HOST, port=int(PORT), debug=DEBUG)
