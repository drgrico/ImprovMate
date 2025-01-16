import { Box, Button, Container, Grid, Modal, Select, Stack, Text } from '@mantine/core'
import { useRef, useState } from 'react'
import useWebcam from '../hooks/useWebcam';
import getAxiosInstance from '../utils/axiosInstance';
import { useDisclosure, useInterval } from '@mantine/hooks';
import Webcam from 'react-webcam';
import { useMutation } from '@tanstack/react-query';
import { appendStory, chooseAction, getLastKeyPoint, getStoryText, setFinished, useAdventureStore, useKeyPointsState } from '../stores/adventureStore';
import { createCallContext, createCallLanguage } from '../utils/llmIntegration';
import HintsModal from './HintsModal';
import useMic from '../hooks/useMic';
import { usePreferencesStore } from "../stores/preferencesStore";

type Props = {
    display: boolean;
    setGenerated: (value: boolean) => void;
    finalAction: () => void;
}

const ImprovPartUploadModal = ({ display, setGenerated, finalAction }: Props) => {
    const { webcamRef, capture } = useWebcam();
    const { setAudioChunks, audioChunks, start: startAudio, stop: stopAudio } = useMic();
    const [userDevices, setUserDevices] = useState<MediaDeviceInfo[]>([]);
    const [activeDevice, setActiveDevice] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [frames, setFrames] = useState<string[]>([]);
    const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const chunks: Blob[] = [];
    const interval = useInterval(() => {
      const frame = capture();
      if (frame) {
        setFrames((prevFrames) => [...prevFrames, frame]);
      }
    }, 300);

    const [hintsModal, { open: openHints, close: closeHints }] = useDisclosure();
    const [selectedHints, setSelectedHints] = useState<{ [category: string]: string }>({});
    const [endStory, setEndStory] = useState(false);
    const language = usePreferencesStore.use.language();

    const instance = getAxiosInstance();
    const uploadImprov = useMutation({
        mutationKey: ['improv'],
        mutationFn: ({ frames, audioResult }: { frames: string[], audioResult: any }) => {
            const story = getStoryText()?.join(" ");

            return instance.post('/story/process_improv', {
                frames, audioResult: audioResult, story: story, hints: selectedHints, language: language, end: false,
            }).then((res) => res.data);
        },
        onSuccess: (data) => {
            console.log("Motion uploaded", data);
            setFrames([]);
            
            if (endStory) {
                handleEnding.mutate(data);
            }
            else {
                handleResult.mutate(data);
            }
            // finalAction(); //Moved to handleResult
        }
    });

    const speechToText = useMutation({
        mutationKey: ['speech-to-text'],
        mutationFn: (audioBlob: string) => {
            return instance.post('/story/speech-to-text',
                createCallLanguage(audioBlob)).then((res) => res.data);
        },
        onSuccess: (data) => {
            setAudioChunks([]);
            console.log("Speech-to-text result:", data);
        }
    });

    const handleResult = useMutation({
        mutationKey: ["improv-part"],
        mutationFn: (improv: any) => {
            console.log("Improv in handleResult: ", improv);
            const story = getStoryText()?.join(" ");

            return instance
                .post("/story/improvpart", 
                    createCallContext({...{
                        improv: improv, 
                        story: story, 
                        premise: useAdventureStore.getState().premise?.desc,
                        keypoint: getLastKeyPoint()
                    }}))
                .then((res) => res.data.data);
            },
        onSuccess: (data) => {
            console.log("Part generated with improv: ", data);
            appendStory(data, true);
            setSelectedHints({}); //TODO: put it after usage, here ok?
            chooseAction(null); //TODO: do I need this?
            setGenerated(true);
            finalAction();    
        },
    });

    const handleEnding = useMutation({
        mutationKey: ["motion-part"],
        mutationFn: (improv: any) => {
            console.log("Improv in handleResult: ", improv);
            const story = getStoryText()?.join(" ");

            return instance
                .post("/story/end_story_improv", {story: story, improv: improv})
                .then((res) => res.data.data);
            },
        onSuccess: (data) => {
            console.log("Part generated with improv: ", data);
            appendStory(data, false);
            setSelectedHints({}); //TODO: put it after usage, here ok?
            chooseAction(null); //TODO: do I need this?
            setGenerated(false);
            setFinished();
            finalAction();          
        },
    });

    const handleStartRecording = () => {
        console.log("Starting recording...");
        setFrames([]);
        setAudioChunks([]);
        setIsCapturing(true);
        interval.start();
        startAudio();
        chunks.length = 0; // Clear chunks before starting a new recording
        if (webcamRef.current && webcamRef.current.video) {
            const stream = webcamRef.current.video.srcObject as MediaStream;
            navigator.mediaDevices.getUserMedia({ audio: true }).then((audioStream) => {
            const combinedStream = new MediaStream([...stream.getVideoTracks(), ...audioStream.getAudioTracks()]);
            mediaRecorder.current = new MediaRecorder(combinedStream);
            mediaRecorder.current.onstart = () => {
                console.log("ON START");
                setMediaBlob(null);
            };
            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                chunks.push(event.data);
                }
            };
            mediaRecorder.current.onstop = () => {
                const blob = new Blob(chunks, { type: "video/mp4" });
                setMediaBlob(blob);
            };
            mediaRecorder.current.start();
            }).catch((error) => {
            console.error("Error accessing media devices.", error);
            });
        }
        else {
                console.log("No webcamRef.current or webcamRef.current.video");
        }
        // Stop automatically after 10 seconds
        setTimeout(() => {
            if (isCapturing) {
            console.log("TIMEOUT - Stopping recording");
            handleStopRecording();
            }
        }, 10000);
    }

    const handleStopRecording = () => {
        console.log("Stopping recording...");
        setIsCapturing(false);
        interval.stop();
        stopAudio();
        console.log('Audio chunks after stopping:', audioChunks);
        mediaRecorder.current?.stop();
    }

    const handleUpload = async() => {
        console.log(`handleUpload: frames ${frames.length}, audioChunks ${audioChunks.length}`);
        if (frames.length === 0 || audioChunks.length == 0) return;
        
        const audioChunk = audioChunks[0];
        console.log("Audio chunk:", audioChunk);
        const base64Audio = await convertBlobToBase64(audioChunk);

        const audioResult = await speechToText.mutateAsync(base64Audio);
        const motionResult = await uploadImprov.mutateAsync({frames, audioResult}); //ADD audioResult to the motionResult??
        
        console.log("Motion result: ", motionResult);
        console.log("Audio result: ", audioResult);
    }

    const convertBlobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    const handleClose = () => {
        setFrames([]);
        setAudioChunks([]);
        chunks.length = 0; //TODO: setMediaBlob(null); ??
        finalAction();
    }

    return (
        <>
        <Box className="motion-upload__wrapper">
          <Box className="motion-upload__content">
            <Modal opened={display} onClose={handleClose}
              size="lg" title="Capture Motion"
              centered>
              <Container>
                <Stack>
                  <Grid>
                    <Grid.Col span={6}>
                      <Box className='motion-upload__devices'>
                          <Select data={
                              userDevices.map((device) => ({
                                  value: device.deviceId,
                                  label: device.label,
                              }))
                          } value={activeDevice}
                              onChange={(value) => setActiveDevice(value)}
                              placeholder="Select device" />
                      </Box>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Box>
                        <Button fullWidth onClick={openHints}>
                          Hints
                        </Button>
                      </Box>
                    </Grid.Col>
                  </Grid>
                  <Box className="motion-upload__webcam"
                    style={{
                      position: 'relative',
                    }}>
                    <Box className="motion-upload__overview"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 10,
                      }}
                      hidden={(frames.length === 0 || isCapturing || !mediaBlob) && !handleResult.isPending}>
                      {(frames.length != 0 && !isCapturing && mediaBlob || handleResult.isPending) && (
                          <Box>
                              <video controls width="100%" style={{ zIndex: 20 }}>
                              <source src={URL.createObjectURL(mediaBlob)} type="video/mp4" />
                              </video>
                          </Box>
                      )}
                    </Box>
                    {(<Webcam ref={webcamRef} width="100%" videoConstraints={{
                      deviceId: activeDevice ?? undefined,
                    }} 
                      onUserMedia={
                          () => {
                              if (userDevices.length === 0)
                                  navigator.mediaDevices.enumerateDevices()
                                      .then((devices) => {
                                          const videoDevices = devices.filter(
                                              (device) => device.kind === 'videoinput'
                                          );
                                          setUserDevices(videoDevices);
                                          setActiveDevice(videoDevices[0].deviceId);
                                      });
                          }
                      } />)}
                  </Box>
                  <Grid>
                      <Grid.Col span={6}>
                          {isCapturing && (
                              <Button onClick={handleStopRecording} fullWidth
                                  color='red'
                                  disabled={!isCapturing}>Stop Recording</Button>
                          )}
                          {!isCapturing &&
                            <Button onClick={handleStartRecording} fullWidth
                                color={
                                    (frames.length > 0 || handleResult.isPending) ? 'orange' : 'violet'
                                }
                                disabled={isCapturing || uploadImprov.isPending || handleResult.isPending}>
                                {
                                    isCapturing ? 'Recording...' : (frames.length > 0 || handleResult.isPending) ? 'Retake' : 'Start Recording'
                                }
                            </Button>
                          }
                      </Grid.Col>
                      <Grid.Col span={6}>
                          <Button onClick={handleUpload} fullWidth
                              disabled={frames.length === 0 || isCapturing}
                              loading={uploadImprov.isPending || handleResult.isPending}
                              loaderProps={{color: 'white', size: 'md', type: 'dots'}}>
                                  Send
                          </Button>
                      </Grid.Col>
                  </Grid>
                  {uploadImprov.isError && (
                      <Text c="red">{uploadImprov.error.message}</Text>
                  )}
                </Stack>
              </Container>
            </Modal>
          </Box>
        </Box>
        <HintsModal display={hintsModal} 
                    ending={false}
                    storyImprov={true} 
                    selectedHints={selectedHints} 
                    setSelectedHints={setSelectedHints} 
                    setEndStory={setEndStory}
                    finalAction={closeHints} />
      </>
    )
}

export default ImprovPartUploadModal