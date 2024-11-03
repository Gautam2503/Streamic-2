"use client"
import { useEffect, useRef, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
//@ts-ignore
import { ChevronUp, ChevronDown, ThumbsDown, Play, Share2, Axis3DIcon } from "lucide-react"
//@ts-ignore
import { toast, ToastContainer } from 'react-toastify'
import { Appbar } from '../components/Appbar'
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import { YT_REGEX } from '../lib/utils'
//@ts-ignore
import YouTubePlayer from 'youtube-player';
import axios from 'axios';

interface Video {
    id: string,
    type: string,
    url: string,
    extractedId: string,
    title: string,
    smallImg: string,
    bigImg: string,
    active: boolean,
    userId: string,
    upvotes: number,
    haveUpvoted: boolean
}

const bog = "orem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.orem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
const REFRESH_INTERVAL_MS = 10 * 1000;

export default function StreamView({
    creatorId,
    playVideo = false
}: {
    creatorId: string;
    playVideo: boolean;
}) {
  const [inputLink, setInputLink] = useState('')
  const [queue, setQueue] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(false);
  const [playNextLoader, setPlayNextLoader] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement | null>(null);

  // Fetch streams and refresh the queue
  async function refreshStreams() {
    try {
      const res = await fetch(`/api/streams/?creatorId=${creatorId}`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch streams");
      }
      const json = await res.json();
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      setQueue(json.streams.sort((a: any, b: any) => a.upvotes < b.upvotes ? 1 : -1));

      setCurrentVideo(video => {
        if (video?.id === json.activeStream?.stream?.id) {
          return video;
        }
        return json.activeStream.stream;
      });
    } catch (error) {
      console.error("Error refreshing streams:", error);
    }
  }

  // Set up an interval to refresh streams periodically
  useEffect(() => {
    refreshStreams();
    const interval = setInterval(() => {
      refreshStreams();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval); // Clear interval on component unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize YouTube player and handle video end event
  useEffect(() => {
    if (!videoPlayerRef.current || !currentVideo?.extractedId) {
      return;
    }

    const player = YouTubePlayer(videoPlayerRef.current);

    // Load and play the current video
    player.loadVideoById(currentVideo.extractedId);
    player.playVideo();

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    function eventHandler(event: any) {
      if (event.data === 0) { // Video ended
        playNext();
      }
    }

    // Listen for state changes (e.g., video ended)
    player.on('stateChange', eventHandler);

    return () => {
      player.destroy(); // Clean up the player on unmount
    };
  }, [currentVideo]);





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Prepare the body
    const body = JSON.stringify({
        creatorId,
        url: inputLink,
        bogus: bog
    });

    try {
        const res = await fetch("/api/streams", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body, 'utf-8').toString(),
                 // Adding Content-Lengtha
            },
            body,
        });
        console.log(Buffer.byteLength(body, 'utf-8').toString());
        if (!res.ok) {
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }

        const newStream = await res.json();
        console.log(newStream);
        setQueue([...queue, newStream]);
    } catch (error) {
        console.error("Error adding video:", error);
    } finally {
        setLoading(false);
        setInputLink('');
    }
};



  // Handle video submission
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);

//     // Prepare the body
//     const body = {
//         creatorId,
//         url: inputLink,
//     };

//     try {
//         const res = await axios.post("/api/streams", body, {
//             headers: {
//                 "Content-Type": "application/json",
//             },
//         });

//         const newStream = res.data;
//         console.log(newStream);
//         setQueue([...queue, newStream]);
//     } catch (error) {
//         console.error("Error adding video:", error);
//     } finally {
//         setLoading(false);
//         setInputLink('');
//     }
// };

  // Handle upvote/downvote
  const handleVote = (id: string, isUpvote: boolean) => {
    setQueue(queue.map(video =>
      video.id === id
        ? {
          ...video,
          upvotes: isUpvote ? video.upvotes + 1 : video.upvotes - 1,
          haveUpvoted: !video.haveUpvoted
        }
        : video
    ).sort((a, b) => (b.upvotes) - (a.upvotes)));

    fetch(`/api/streams/${isUpvote ? "upvote" : "downvote"}`, {
      method: "POST",
      body: JSON.stringify({
        streamId: id
      })
    }).catch(err => console.error("Error in voting:", err));
  };

  // Handle playing the next video
  const playNext = async () => {
    if (queue.length > 0) {
      try {
        setPlayNextLoader(true);
        const res = await fetch('/api/streams/next', {
          method: "GET",
        });
        const json = await res.json();
        setCurrentVideo(json.stream);
        setQueue(q => q.filter(x => x.id !== json.stream?.id));
      } catch (e) {
        console.error("Error in playing next video:", e);
      } finally {
        setPlayNextLoader(false);
      }
    }
  };

  // Handle sharing functionality
  const handleShare = () => {
    const shareableLink = `${window.location.origin}/creator/${creatorId}`;
    console.log("Shareable Link: ", shareableLink);
    navigator.clipboard.writeText(shareableLink).then(() => {
      toast.success('Link copied to clipboard!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }).catch(err => {
      console.error('Could not copy text: ', err);
      toast.error('Failed to copy link. Please try again.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[rgb(10,10,10)] text-gray-200">
      <Appbar />
      <div className='flex justify-center'>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 w-screen max-w-screen-xl pt-8">
          <div className='col-span-3'>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Upcoming Songs</h2>
              {queue.length === 0 && <Card className="bg-gray-900 border-gray-800 w-full">
                <CardContent className="p-4"><p className="text-center py-8 text-gray-400">No videos in queue</p></CardContent></Card>}
              {queue.map((video) => (
                <Card key={video.id} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4 flex items-center space-x-4">
                    <img
                      src={video.smallImg}
                      alt={`Thumbnail for ${video.title}`}
                      className="w-30 h-20 object-cover rounded"
                    />
                    <div className="flex-grow">
                      <h3 className="font-semibold text-white">{video.title}</h3>
                      <div className="flex items-center space-x-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVote(video.id, !video.haveUpvoted)}
                          className="flex items-center space-x-1 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                        >
                          {video.haveUpvoted ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          <span>{video.upvotes}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className='col-span-2'>
            <div className="max-w-4xl mx-auto p-4 space-y-6 w-full">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">Add a song</h1>
                <Button onClick={handleShare} className="bg-purple-700 hover:bg-purple-800 text-white">
                  <Share2 className="mr-2 h-4 w-4" /> Share
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-2">
                <Input
                  type="text"
                  placeholder="Paste YouTube link here"
                  value={inputLink}
                  onChange={(e) => setInputLink(e.target.value)}
                  className="bg-gray-900 text-white border-gray-700 placeholder-gray-500"
                />
                <Button disabled={loading} type="submit"className="w-full bg-purple-700 hover:bg-purple-800 text-white"
                >
                  {loading ? "Submitting..." : "Add to Queue"}
                </Button>
              </form>
              <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">Now Playing</h2>
                        <Card className="bg-gray-900 border-gray-800">
                            <CardContent className="p-4">
                                {currentVideo ? (
                                    <div>
                                        {playVideo ? <>
                                        {/* @ts-ignore */}
                                            <div ref={videoPlayerRef} className='w-full' />
                                            {/* <iframe width={"100%"} height={300} src={`https://www.youtube.com/embed/${currentVideo.extractedId}?autoplay=1`} allow="autoplay"></iframe> */}
                                        </> : <>
                                        <img 
                                            src={currentVideo.bigImg} 
                                            alt='Thumbnail for current video'
                                            className="w-full h-72 object-cover rounded"
                                        />
                                        <p className="mt-2 text-center font-semibold text-white">{currentVideo.title}</p>
                                    </>}
                                </div>) : (
                                    <p className="text-center py-8 text-gray-400">No video playing</p>
                                )}
                            </CardContent>
                        </Card>
                        {playVideo && <Button disabled={playNextLoader} onClick={playNext} className="w-full bg-purple-700 hover:bg-purple-800 text-white">
                            <Play className="mr-2 h-4 w-4" /> {playNextLoader ? "Loading..." : "Play next"}
                        </Button>}
                        </div>
              </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}