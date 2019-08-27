/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <matdbg/ShaderEditor.h>

#include <filaflat/BlobDictionary.h>
#include <filaflat/DictionaryReader.h>

#include <backend/DriverEnums.h>

#include <utils/Log.h>

#include <sstream>

namespace filament {
namespace matdbg {

using namespace backend;
using namespace filaflat;

using filamat::ChunkType;

ShaderEditor::ShaderEditor(Backend backend, const void* data, size_t size) :
        mBackend(backend), mOriginalPackage(data, size), mMaterialChunk(mOriginalPackage) {
    switch (backend) {
        case Backend::OPENGL:
            mMaterialTag = ChunkType::MaterialGlsl;
            mDictionaryTag = ChunkType::DictionaryGlsl;
            break;
        case Backend::METAL:
            mMaterialTag = ChunkType::MaterialMetal;
            mDictionaryTag = ChunkType::DictionaryMetal;
            break;
        case Backend::VULKAN:
            mMaterialTag = ChunkType::MaterialSpirv;
            mDictionaryTag = ChunkType::DictionarySpirv;
            break;
        default:
            break;
    }
}

ShaderEditor::~ShaderEditor() {
    delete mEditedPackage;
}

bool ShaderEditor::applyShaderEdit(backend::ShaderModel shaderModel, uint8_t variant,
            backend::ShaderType stage, const char* source) {
    if (!mOriginalPackage.parse()) {
        return false;
    }

    ChunkContainer const& cc = mOriginalPackage;
    if (!cc.hasChunk(mMaterialTag) || !cc.hasChunk(mDictionaryTag)) {
        return false;
    }

    BlobDictionary blobDictionary;
    if (!DictionaryReader::unflatten(cc, mDictionaryTag, blobDictionary)) {
        return false;
    }

    // Clone all chunks except DictionaryGlsl, MaterialGlsl, etc.
    std::stringstream sstream(std::string((const char*) cc.getData(), cc.getSize()));
    std::stringstream tstream;
    {
        uint64_t type;
        uint32_t size;
        std::vector<uint8_t> content;
        while (sstream) {
            sstream.read((char*) &type, sizeof(type));
            sstream.read((char*) &size, sizeof(size));
            content.resize(size);
            sstream.read((char*) content.data(), size);
            if (ChunkType(type) == mDictionaryTag || ChunkType(type) == mMaterialTag) {
                continue;
            }
            tstream.write((char*) &type, sizeof(type));
            tstream.write((char*) &size, sizeof(size));
            tstream.write((char*) content.data(), size);
        }
    }

    // Write the new dictionary chunk.
    switch (mBackend) {
        case Backend::METAL:
        case Backend::OPENGL: {
            uint64_t type = mDictionaryTag;
            uint32_t stringCount = blobDictionary.getSize();
            tstream.write((char*) &type, sizeof(type));
            tstream.write((char*) &stringCount, sizeof(stringCount));
            for (uint32_t stringIndex = 0; stringIndex < stringCount; ++stringIndex) {
                const char* line = blobDictionary.getString(stringIndex);
                tstream.write(line, strlen(line) + 1);
            }
            break;
        }
        case Backend::VULKAN:
        default:
            return false;
    }

    // Write the new shaders chunk.
    uint64_t numShaders = 0; // TODO EYEBALL
    for (uint64_t i = 0 ; i < numShaders; i++) {
        uint8_t shaderModelValue;
        uint8_t variantValue;
        uint8_t pipelineStageValue;
        uint32_t offsetValue;

        // TODO EYEBALL
    }

    const size_t size = tstream.str().size();
    uint8_t* data = new uint8_t[size];
    memcpy(data, tstream.str().data(), size);
    mEditedPackage = new filaflat::ChunkContainer(data, size);

    return true;
}

const uint8_t* ShaderEditor::getEditedPackage() const {
    return  (const uint8_t*) mEditedPackage->getData();
}

size_t ShaderEditor::getEditedSize() const {
    return  mEditedPackage->getSize();
}

} // namespace matdbg
} // namespace filament
